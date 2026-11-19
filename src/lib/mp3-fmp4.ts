/**
 * Repackages MP3 clips as fragmented MP4, so they can be appended to a
 * MediaSource one after another and play as a single continuous stream.
 *
 * Firefox's Media Source Extensions accept MP3 only inside MP4, not as a raw
 * `audio/mpeg` stream. The frames are copied unchanged: MP4 is only the
 * container, so no audio is decoded or re-encoded.
 */

/** MSE types for MP3 in MP4, in order of preference. */
export const MP3_IN_MP4_TYPES = [
  'audio/mp4; codecs="mp3"',
  'audio/mp4; codecs="mp4a.6B"',
];

// MPEG-1 Audio. Decoders read the version from each frame header, so it also
// covers the MPEG-2 and 2.5 frames that low sample rates use.
const MPEG_AUDIO_OBJECT_TYPE = 0x6b;
const TRACK_ID = 1;

// Layer III bitrates in kbit/s, by bitrate index.
const MPEG1_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MPEG2_BITRATES = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
];

// Sample rates by version bits (MPEG-2.5, reserved, MPEG-2, MPEG-1), then by
// sample rate index.
const SAMPLE_RATES: Record<number, number[]> = {
  0: [11025, 12000, 8000],
  2: [22050, 24000, 16000],
  3: [44100, 48000, 32000],
};

interface FrameHeader {
  channels: number;
  length: number;
  sampleRate: number;
  samplesPerFrame: number;
}

/** Reads a Layer III frame header at `offset`, or returns undefined. */
const readFrameHeader = (
  bytes: Uint8Array,
  offset: number,
): FrameHeader | undefined => {
  if (offset + 4 > bytes.length) return undefined;
  const [b0, b1, b2, b3] = bytes.subarray(offset, offset + 4);
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return undefined;

  const version = (b1 >> 3) & 0b11;
  const layer = (b1 >> 1) & 0b11;
  const bitrateIndex = b2 >> 4;
  const sampleRateIndex = (b2 >> 2) & 0b11;
  if (version === 1 || layer !== 0b01) return undefined;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return undefined;
  }

  const mpeg1 = version === 3;
  const bitrate =
    (mpeg1 ? MPEG1_BITRATES : MPEG2_BITRATES)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][sampleRateIndex];
  const padding = (b2 >> 1) & 1;
  const samplesPerFrame = mpeg1 ? 1152 : 576;

  return {
    channels: b3 >> 6 === 0b11 ? 1 : 2,
    length:
      Math.floor(((samplesPerFrame / 8) * bitrate) / sampleRate) + padding,
    sampleRate,
    samplesPerFrame,
  };
};

/** Length of a leading ID3v2 tag, which some encoders write before the audio. */
const id3Length = (bytes: Uint8Array) => {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return 0;
  }
  // The size is "syncsafe": 7 bits per byte. A footer adds another 10 bytes.
  const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  return 10 + size + (bytes[5] & 0x10 ? 10 : 0);
};

export interface Mp3Frames {
  channels: number;
  frames: Uint8Array[];
  sampleRate: number;
  samplesPerFrame: number;
}

/**
 * Splits an MP3 file into its frames. Anything between frames, such as an
 * ID3v1 tag at the end, is skipped. While searching for a frame, a header only
 * counts when another frame or the end of the data follows it, so stray sync
 * bytes are not mistaken for one. A header right where the previous frame
 * ended needs no such check.
 *
 * Throws when the data holds no MP3 frames.
 */
export const parseMp3 = (bytes: Uint8Array): Mp3Frames => {
  const frames: Uint8Array[] = [];
  let first: FrameHeader | undefined;
  let offset = id3Length(bytes);
  let previousEnd: number | undefined;

  while (offset < bytes.length) {
    const header = readFrameHeader(bytes, offset);
    const end = header ? offset + header.length : 0;
    const confirmed =
      header &&
      end <= bytes.length &&
      (offset === previousEnd ||
        end === bytes.length ||
        readFrameHeader(bytes, end) !== undefined);

    if (!header || !confirmed) {
      offset += 1;
      continue;
    }

    // A clip comes from one encoder run, so its frames share one format.
    // A frame in another format would be mislabeled, so it is skipped.
    first ??= header;
    if (
      header.sampleRate === first.sampleRate &&
      header.samplesPerFrame === first.samplesPerFrame
    ) {
      frames.push(bytes.subarray(offset, end));
    }
    offset = end;
    previousEnd = end;
  }

  if (!first) throw new Error("No MP3 frames found.");

  return {
    channels: first.channels,
    frames,
    sampleRate: first.sampleRate,
    samplesPerFrame: first.samplesPerFrame,
  };
};

const concat = (parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const u8 = (...values: number[]) => new Uint8Array(values);

const u16 = (value: number) => u8(value >> 8, value & 0xff);

const u32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};

const u64 = (value: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value));
  return bytes;
};

const zeros = (length: number) => new Uint8Array(length);

const ascii = (text: string) =>
  new Uint8Array([...text].map((char) => char.charCodeAt(0)));

const box = (type: string, ...payload: Uint8Array[]) => {
  const body = concat(payload);
  return concat([u32(8 + body.length), ascii(type), body]);
};

const fullBox = (
  type: string,
  version: number,
  flags: number,
  ...payload: Uint8Array[]
) =>
  box(
    type,
    u8(version, flags >> 16, (flags >> 8) & 0xff, flags & 0xff),
    ...payload,
  );

// The identity transform every track and movie header carries.
const MATRIX = concat(
  [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].map(u32),
);

// An MPEG-4 descriptor: tag, length, contents. Every descriptor here is
// shorter than 128 bytes, so a one-byte length suffices.
const descriptor = (tag: number, ...payload: Uint8Array[]) => {
  const body = concat(payload);
  return concat([u8(tag, body.length), body]);
};

const initSegment = ({ channels, sampleRate }: Mp3Frames) => {
  const esds = fullBox(
    "esds",
    0,
    0,
    descriptor(
      0x03, // ES_Descriptor
      u16(0), // ES_ID
      u8(0), // flags
      descriptor(
        0x04, // DecoderConfigDescriptor
        u8(MPEG_AUDIO_OBJECT_TYPE),
        u8(0x15), // audio stream
        zeros(3), // buffer size
        u32(0), // max bitrate
        u32(0), // average bitrate
      ),
      descriptor(0x06, u8(0x02)), // SLConfigDescriptor, MP4 predefined
    ),
  );

  const mp4a = box(
    "mp4a",
    zeros(6),
    u16(1), // data reference index
    zeros(8),
    u16(channels),
    u16(16), // sample size
    zeros(4),
    u32(sampleRate * 0x10000), // 16.16 fixed point
    esds,
  );

  const emptyTable = (type: string) => fullBox(type, 0, 0, u32(0));

  const stbl = box(
    "stbl",
    fullBox("stsd", 0, 0, u32(1), mp4a),
    emptyTable("stts"),
    emptyTable("stsc"),
    fullBox("stsz", 0, 0, u32(0), u32(0)),
    emptyTable("stco"),
  );

  const minf = box(
    "minf",
    fullBox("smhd", 0, 0, u16(0), u16(0)),
    box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))),
    stbl,
  );

  const mdia = box(
    "mdia",
    fullBox(
      "mdhd",
      0,
      0,
      u32(0), // creation time
      u32(0), // modification time
      u32(sampleRate), // timescale
      u32(0), // duration
      u16(0x55c4), // language "und"
      u16(0),
    ),
    fullBox(
      "hdlr",
      0,
      0,
      u32(0),
      ascii("soun"),
      zeros(12),
      ascii("SoundHandler\0"),
    ),
    minf,
  );

  const trak = box(
    "trak",
    fullBox(
      "tkhd",
      0,
      0x3, // enabled, in movie
      u32(0), // creation time
      u32(0), // modification time
      u32(TRACK_ID),
      zeros(4),
      u32(0), // duration
      zeros(8),
      u16(0), // layer
      u16(0), // alternate group
      u16(0x0100), // volume
      zeros(2),
      MATRIX,
      u32(0), // width
      u32(0), // height
    ),
    mdia,
  );

  const moov = box(
    "moov",
    fullBox(
      "mvhd",
      0,
      0,
      u32(0), // creation time
      u32(0), // modification time
      u32(sampleRate), // timescale
      u32(0), // duration
      u32(0x10000), // rate
      u16(0x0100), // volume
      zeros(10),
      MATRIX,
      zeros(24),
      u32(TRACK_ID + 1), // next track id
    ),
    trak,
    box(
      "mvex",
      fullBox(
        "trex",
        0,
        0,
        u32(TRACK_ID),
        u32(1), // sample description index
        u32(0), // default duration
        u32(0), // default size
        u32(0), // default flags: every sample is a sync sample
      ),
    ),
  );

  return concat([
    box("ftyp", ascii("isom"), u32(0x200), ascii("isomiso6mp41")),
    moov,
  ]);
};

const mediaSegment = (
  { frames, samplesPerFrame }: Mp3Frames,
  sequenceNumber: number,
  decodeTime: number,
) => {
  const trunFlags = 0x000001 | 0x000100 | 0x000200; // data offset, durations, sizes
  const samples = frames.map((frame) =>
    concat([u32(samplesPerFrame), u32(frame.length)]),
  );

  const moofFor = (dataOffset: number) =>
    box(
      "moof",
      fullBox("mfhd", 0, 0, u32(sequenceNumber)),
      box(
        "traf",
        fullBox("tfhd", 0, 0x020000, u32(TRACK_ID)), // default base is moof
        fullBox("tfdt", 1, 0, u64(decodeTime)),
        fullBox(
          "trun",
          0,
          trunFlags,
          u32(frames.length),
          u32(dataOffset),
          ...samples,
        ),
      ),
    );

  // The data offset counts from the start of moof to the first sample, past
  // the 8-byte mdat header. Its value does not change the moof's size.
  const moofLength = moofFor(0).length;
  return concat([moofFor(moofLength + 8), box("mdat", ...frames)]);
};

/**
 * Turns successive MP3 clips into MSE segments for one continuous track. The
 * first clip, and any clip whose format differs from the one before, also gets
 * an initialization segment.
 */
export class Mp3Fmp4Muxer {
  private format: { channels: number; sampleRate: number } | undefined;
  private sequenceNumber = 0;
  private decodeTime = 0;

  /** The segments to append for `mp3`, in order. Throws if it is not MP3. */
  segments(mp3: Uint8Array): Uint8Array[] {
    const parsed = parseMp3(mp3);
    const segments: Uint8Array[] = [];

    if (
      this.format?.channels !== parsed.channels ||
      this.format?.sampleRate !== parsed.sampleRate
    ) {
      this.format = {
        channels: parsed.channels,
        sampleRate: parsed.sampleRate,
      };
      this.decodeTime = 0;
      segments.push(initSegment(parsed));
    }

    this.sequenceNumber += 1;
    segments.push(mediaSegment(parsed, this.sequenceNumber, this.decodeTime));
    this.decodeTime += parsed.frames.length * parsed.samplesPerFrame;

    return segments;
  }
}
