import { vi } from "vitest";

/**
 * jsdom's HTMLMediaElement cannot play anything, so hooks driving an <audio>
 * element get this fake instead. Like a real element, assigning `src` resets
 * `playbackRate` to `defaultPlaybackRate`.
 */
export class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  /** Set to a DOMException name to make the next play() reject with it. */
  static rejectNextPlay: string | undefined;

  #src = "";
  defaultPlaybackRate = 1;
  playbackRate = 1;
  paused = true;

  constructor() {
    super();
    FakeAudio.instances.push(this);
  }

  get src() {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    this.paused = true;
    this.playbackRate = this.defaultPlaybackRate;
  }

  play = vi.fn(async () => {
    const rejection = FakeAudio.rejectNextPlay;
    if (rejection) {
      FakeAudio.rejectNextPlay = undefined;
      throw new DOMException("play() was rejected", rejection);
    }
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  /** Simulates the browser failing to decode the current clip. */
  breakClip() {
    this.paused = true;
    this.dispatchEvent(new Event("error"));
  }

  /** Simulates the current clip playing to its end. */
  finish() {
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
  }
}

export interface FakeSpeechRequest {
  articleId: number;
  text: string;
  signal: AbortSignal;
  settled: boolean;
  /** Answers with a clip whose object URL is `blob:<text>`. */
  respond: () => void;
  fail: (status?: number) => void;
}

/**
 * Installs a fake `fetch` for /api/speech, the fake `Audio` constructor and
 * object-URL stubs. Each request stays pending until the test calls
 * `respond()` or `fail()` on it. Call `vi.unstubAllGlobals()` afterwards.
 */
export const installServerSpeech = ({
  ignoreAbort = false,
}: {
  /**
   * Models a response that was already in hand when the request was aborted:
   * the fetch does not reject on abort and can still be answered.
   */
  ignoreAbort?: boolean;
} = {}) => {
  FakeAudio.instances = [];
  FakeAudio.rejectNextPlay = undefined;
  const requests: FakeSpeechRequest[] = [];

  const fetch = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise((resolve, reject) => {
        const body = JSON.parse(init.body as string) as {
          articleId: number;
          text: string;
        };
        const signal = init.signal as AbortSignal;
        if (!ignoreAbort) {
          signal.addEventListener("abort", () =>
            reject(new DOMException("The request was aborted", "AbortError")),
          );
        }

        const request: FakeSpeechRequest = {
          ...body,
          signal,
          settled: false,
          respond: () => {
            request.settled = true;
            resolve({
              ok: true,
              status: 200,
              blob: async () => ({ text: body.text }),
            });
          },
          fail: (status = 502) => {
            request.settled = true;
            resolve({ ok: false, status, blob: async () => ({}) });
          },
        };
        requests.push(request);
      }),
  );

  const createObjectURL = vi.fn(
    (blob: { text: string }) => `blob:${blob.text}`,
  );
  const revokeObjectURL = vi.fn();

  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("Audio", FakeAudio);
  // jsdom has no object URLs. Stubbing a subclass of URL, rather than
  // assigning to the real one, lets vi.unstubAllGlobals() restore it.
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL =
        createObjectURL as unknown as typeof URL.createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );

  return {
    fetch,
    requests,
    requested: () => requests.map((request) => request.text),
    /** The most recently created audio element. */
    audio: () => FakeAudio.instances.at(-1)!,
    createObjectURL,
    revokeObjectURL,
  };
};
