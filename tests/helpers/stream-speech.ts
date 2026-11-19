import type { StreamFormat } from "@/lib/stream-speech-queue";
import { vi } from "vitest";
import { installServerSpeech } from "./server-speech";

/** Every appended segment lasts this long on the fake media timeline. */
export const SEGMENT_SECONDS = 1;

export const FIREFOX_ANDROID_UA =
  "Mozilla/5.0 (Android 15; Mobile; rv:150.0) Gecko/150.0 Firefox/150.0";
export const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36";
export const SAFARI_MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
export const CHROME_IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.0.0 Mobile/15E148 Safari/604.1";

/** Appends each clip as it is, one segment per clip. */
export const passthroughFormat: StreamFormat = {
  type: "audio/mpeg",
  segmenter: () => (clip) => [clip],
};

const decode = (segment: Uint8Array) => new TextDecoder().decode(segment);

/**
 * jsdom has no Media Source Extensions. Appends finish on the next macrotask,
 * like a real SourceBuffer, and buffer `SEGMENT_SECONDS` each.
 */
export class FakeSourceBuffer extends EventTarget {
  mode = "segments";
  updating = false;
  end = 0;
  /** The decoded text of every segment appended, in order. */
  segments: string[] = [];
  /** Set to make the next appendBuffer() throw, as on a full buffer. */
  throwOnAppend = false;

  constructor(private readonly source: FakeMediaSource) {
    super();
  }

  get buffered() {
    const end = this.end;
    return {
      length: end > 0 ? 1 : 0,
      start: () => 0,
      end: () => end,
    };
  }

  appendBuffer(segment: Uint8Array) {
    if (this.updating) throw new DOMException("busy", "InvalidStateError");
    if (this.throwOnAppend) {
      this.throwOnAppend = false;
      throw new DOMException("full", "QuotaExceededError");
    }
    // Appending to an ended source reopens it.
    if (this.source.readyState === "ended") this.source.readyState = "open";
    this.updating = true;
    setTimeout(() => {
      this.segments.push(decode(segment));
      this.end += SEGMENT_SECONDS;
      this.updating = false;
      this.dispatchEvent(new Event("updateend"));
      this.source.element?.dataArrived();
    }, 0);
  }
}

export class FakeMediaSource extends EventTarget {
  static instances: FakeMediaSource[] = [];
  static supportedTypes: string[] = [];
  static isTypeSupported = vi.fn((type: string) =>
    FakeMediaSource.supportedTypes.includes(type),
  );

  readyState: "closed" | "open" | "ended" = "closed";
  buffer: FakeSourceBuffer | undefined;
  element: FakeStreamAudio | undefined;
  endOfStream = vi.fn(() => {
    this.readyState = "ended";
  });

  constructor() {
    super();
    FakeMediaSource.instances.push(this);
  }

  addSourceBuffer = vi.fn((_type: string) => {
    this.buffer = new FakeSourceBuffer(this);
    return this.buffer;
  });

  attach(element: FakeStreamAudio) {
    this.element = element;
    setTimeout(() => {
      this.readyState = "open";
      this.dispatchEvent(new Event("sourceopen"));
    }, 0);
  }

  get end() {
    return this.buffer?.end ?? 0;
  }
}

/** An <audio> element playing a FakeMediaSource. */
export class FakeStreamAudio extends EventTarget {
  static instances: FakeStreamAudio[] = [];
  static rejectNextPlay: string | undefined;
  static sources = new Map<string, FakeMediaSource>();

  #src = "";
  #currentTime = 0;
  // Firefox keeps treating an element that reached its end as ended after
  // more data is appended, until it seeks.
  #ended = false;
  source: FakeMediaSource | undefined;
  defaultPlaybackRate = 1;
  playbackRate = 1;
  paused = true;
  // Playing, but out of data. Data arriving resumes it with "playing".
  #starved = false;

  constructor() {
    super();
    FakeStreamAudio.instances.push(this);
  }

  get src() {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    this.paused = true;
    this.currentTime = 0;
    this.playbackRate = this.defaultPlaybackRate;
    this.source = FakeStreamAudio.sources.get(value);
    this.source?.attach(this);
  }

  get currentTime() {
    return this.#currentTime;
  }

  set currentTime(value: number) {
    this.#currentTime = value;
    this.#ended = false;
  }

  get ended() {
    return this.#ended;
  }

  removeAttribute = vi.fn((name: string) => {
    if (name === "src") {
      this.#src = "";
      this.source = undefined;
    }
  });

  load = vi.fn();

  play = vi.fn(async () => {
    const rejection = FakeStreamAudio.rejectNextPlay;
    if (rejection) {
      FakeStreamAudio.rejectNextPlay = undefined;
      throw new DOMException("play() was rejected", rejection);
    }
    // As in a browser, playing an element that has ended starts it over.
    if (this.ended) this.currentTime = 0;
    if (!this.paused) return;
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    if (this.currentTime < (this.source?.end ?? 0)) {
      this.dispatchEvent(new Event("playing"));
    } else {
      this.#starved = true;
    }
  });

  pause = vi.fn(() => {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });

  dataArrived() {
    if (!this.paused && this.#starved) {
      this.#starved = false;
      this.dispatchEvent(new Event("playing"));
    }
  }

  /** Plays on to `time` on the media timeline. */
  advanceTo(time: number) {
    this.currentTime = time;
    this.dispatchEvent(new Event("timeupdate"));
  }

  /** Plays to the end of everything appended. */
  playToEnd() {
    this.currentTime = this.source?.end ?? 0;
    this.dispatchEvent(new Event("timeupdate"));
    if (this.source?.readyState === "ended") {
      this.#ended = true;
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
      this.dispatchEvent(new Event("ended"));
    } else {
      this.#starved = true;
      this.dispatchEvent(new Event("waiting"));
    }
  }

  /** Simulates the browser failing to decode the stream. */
  breakStream() {
    this.paused = true;
    this.dispatchEvent(new Event("error"));
  }
}

/**
 * Installs the server-speech fakes plus a fake MediaSource, so the hook
 * streams clips. jsdom's own user agent names AppleWebKit, which would keep
 * the hook on the clip queue, so a Firefox one stands in by default. Call
 * `vi.unstubAllGlobals()` afterwards; the user agent stays until the next
 * install.
 */
export const installStreamSpeech = ({
  supportedTypes = ["audio/mpeg"],
  userAgent = FIREFOX_ANDROID_UA,
}: { supportedTypes?: string[]; userAgent?: string } = {}) => {
  const speech = installServerSpeech();
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  FakeMediaSource.instances = [];
  FakeMediaSource.supportedTypes = supportedTypes;
  FakeStreamAudio.instances = [];
  FakeStreamAudio.rejectNextPlay = undefined;
  FakeStreamAudio.sources = new Map();

  let objectUrls = 0;
  const createObjectURL = vi.fn((object: unknown) => {
    objectUrls += 1;
    const url = `blob:media-source-${objectUrls}`;
    if (object instanceof FakeMediaSource) {
      FakeStreamAudio.sources.set(url, object);
    }
    return url;
  });
  const revokeObjectURL = vi.fn();

  vi.stubGlobal("MediaSource", FakeMediaSource);
  vi.stubGlobal("Audio", FakeStreamAudio);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL =
        createObjectURL as unknown as typeof URL.createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );

  return {
    ...speech,
    createObjectURL,
    revokeObjectURL,
    audio: () => FakeStreamAudio.instances.at(-1)!,
    source: () => FakeMediaSource.instances.at(-1)!,
    /** The text of every segment appended to the current stream. */
    appended: () => FakeMediaSource.instances.at(-1)?.buffer?.segments ?? [],
  };
};
