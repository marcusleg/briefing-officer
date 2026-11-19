import { Mp3Fmp4Muxer, parseMp3 } from "@/lib/mp3-fmp4";
import { describe, expect, it } from "vitest";

// MPEG-2 Layer III, 32 kbit/s, 24 kHz, mono: what TTS services commonly send.
// Each frame is 72 * 32000 / 24000 = 96 bytes and holds 576 samples.
const MPEG2_HEADER = [0xff, 0xf3, 0x44, 0xc0];
const MPEG2_FRAME_LENGTH = 96;

// MPEG-1 Layer III, 128 kbit/s, 44.1 kHz, stereo, padded: 418 bytes and 1152
// samples per frame.
const MPEG1_HEADER = [0xff, 0xfb, 0x92, 0x00];
const MPEG1_FRAME_LENGTH = 418;

const frame = (header: number[], length: number, fill: number) => {
  const bytes = new Uint8Array(length).fill(fill);
  bytes.set(header);
  return bytes;
};

const concat = (...parts: (Uint8Array | number[])[]) => {
  const arrays = parts.map((part) => Uint8Array.from(part));
  const result = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
};

const mpeg2Clip = (frames: number) =>
  concat(
    ...Array.from({ length: frames }, (_, i) =>
      frame(MPEG2_HEADER, MPEG2_FRAME_LENGTH, i + 1),
    ),
  );

interface Box {
  type: string;
  start: number;
  size: number;
  body: Uint8Array;
}

const CONTAINERS = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "dinf",
  "mvex",
  "moof",
  "traf",
]);

/** Walks the box tree, returning every box with its absolute offset. */
const boxes = (bytes: Uint8Array, base = 0): Box[] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found: Box[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const size = view.getUint32(offset);
    const type = new TextDecoder().decode(
      bytes.subarray(offset + 4, offset + 8),
    );
    const body = bytes.subarray(offset + 8, offset + size);
    found.push({ type, start: base + offset, size, body });
    if (CONTAINERS.has(type)) found.push(...boxes(body, base + offset + 8));
    offset += size;
  }
  expect(offset).toBe(bytes.length);
  return found;
};

const find = (list: Box[], type: string) => {
  const box = list.find((candidate) => candidate.type === type);
  expect(box, type).toBeDefined();
  return box!;
};

const u32 = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset);

describe("parseMp3", () => {
  it("splits a clip into its frames and reads the format", () => {
    const parsed = parseMp3(mpeg2Clip(3));

    expect(parsed.frames).toHaveLength(3);
    expect(parsed.frames.every((f) => f.length === MPEG2_FRAME_LENGTH)).toBe(
      true,
    );
    expect(parsed).toMatchObject({
      channels: 1,
      sampleRate: 24000,
      samplesPerFrame: 576,
    });
  });

  it("reads MPEG-1 frames, including padding", () => {
    const clip = concat(
      frame(MPEG1_HEADER, MPEG1_FRAME_LENGTH, 1),
      frame(MPEG1_HEADER, MPEG1_FRAME_LENGTH, 2),
    );

    const parsed = parseMp3(clip);

    expect(parsed.frames).toHaveLength(2);
    expect(parsed).toMatchObject({
      channels: 2,
      sampleRate: 44100,
      samplesPerFrame: 1152,
    });
  });

  it("skips a leading ID3 tag and trailing bytes that are not frames", () => {
    // A 20-byte tag body whose contents look like a frame header.
    const id3 = concat(
      [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20],
      [...MPEG2_HEADER, ...new Array(16).fill(0)],
    );
    const clip = concat(id3, mpeg2Clip(2), [0x54, 0x41, 0x47, 1, 2, 3]);

    const parsed = parseMp3(clip);

    expect(parsed.frames).toHaveLength(2);
    expect(parsed.frames[0][4]).toBe(1);
  });

  it("does not take a stray sync word for a frame", () => {
    // A header that is not followed by another frame or the end of the data.
    const clip = concat([...MPEG2_HEADER, 9, 9], mpeg2Clip(2));

    expect(parseMp3(clip).frames).toHaveLength(2);
  });

  it("rejects data without MP3 frames", () => {
    expect(() => parseMp3(new TextEncoder().encode("Not audio."))).toThrow(
      "No MP3 frames found.",
    );
  });
});

describe("Mp3Fmp4Muxer", () => {
  it("starts the stream with an initialization segment describing MP3", () => {
    const [init] = new Mp3Fmp4Muxer().segments(mpeg2Clip(2));
    const tree = boxes(init);

    expect(tree.filter((box) => !CONTAINERS.has(box.type)).at(0)?.type).toBe(
      "ftyp",
    );
    const mdhd = find(tree, "mdhd");
    expect(u32(mdhd.body, 12)).toBe(24000); // timescale
    expect(find(tree, "hdlr").body.subarray(8, 12)).toEqual(
      new TextEncoder().encode("soun"),
    );

    const stsd = find(tree, "stsd");
    // The mp4a entry follows the full-box header and entry count.
    const mp4a = stsd.body.subarray(8);
    expect(new TextDecoder().decode(mp4a.subarray(4, 8))).toBe("mp4a");
    const channels = (mp4a[24] << 8) | mp4a[25];
    expect(channels).toBe(1);
    expect(u32(mp4a, 32) >>> 16).toBe(24000);
    // The esds names MPEG-1 audio (0x6B) as the object type.
    const esds = mp4a.subarray(36);
    expect(new TextDecoder().decode(esds.subarray(4, 8))).toBe("esds");
    expect(esds[12 + 2 + 3 + 2]).toBe(0x6b);
  });

  it("puts the frames unchanged into a fragment the moof points at", () => {
    const clip = mpeg2Clip(3);
    const [, media] = new Mp3Fmp4Muxer().segments(clip);
    const tree = boxes(media);

    const moof = find(tree, "moof");
    const mdat = find(tree, "mdat");
    expect(mdat.body).toEqual(clip);

    const trun = find(tree, "trun");
    expect(u32(trun.body, 4)).toBe(3); // sample count
    const dataOffset = u32(trun.body, 8);
    expect(moof.start + dataOffset).toBe(mdat.start + 8);
    for (let i = 0; i < 3; i++) {
      expect(u32(trun.body, 12 + i * 8)).toBe(576); // duration
      expect(u32(trun.body, 16 + i * 8)).toBe(MPEG2_FRAME_LENGTH); // size
    }
  });

  it("numbers fragments and continues the decode time across clips", () => {
    const muxer = new Mp3Fmp4Muxer();
    muxer.segments(mpeg2Clip(3));
    const second = muxer.segments(mpeg2Clip(2));

    // Same format, so no new initialization segment.
    expect(second).toHaveLength(1);
    const tree = boxes(second[0]);
    expect(u32(find(tree, "mfhd").body, 4)).toBe(2);
    const tfdt = find(tree, "tfdt");
    expect(tfdt.body[0]).toBe(1); // 64-bit version
    expect(
      Number(
        new DataView(tfdt.body.buffer, tfdt.body.byteOffset).getBigUint64(4),
      ),
    ).toBe(3 * 576);
  });

  it("describes the new format when a clip's format changes", () => {
    const muxer = new Mp3Fmp4Muxer();
    muxer.segments(mpeg2Clip(1));
    const segments = muxer.segments(frame(MPEG1_HEADER, MPEG1_FRAME_LENGTH, 1));

    expect(segments).toHaveLength(2);
    expect(u32(find(boxes(segments[0]), "mdhd").body, 12)).toBe(44100);
  });
});
