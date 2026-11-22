/**
 * Plays text sentence by sentence through a TTS service behind
 * /api/speech.
 *
 * Sentences arrive one at a time while the text is still arriving.
 * Each is synthesized separately and the clips play back to back through one
 * <audio> element, so reading starts after one round trip rather than
 * after the whole text. The sentence playing and the next two are requested,
 * at most two at a time, which keeps a clip ready ahead of the voice without
 * flooding the service.
 *
 * Every clip ends the element's playback before the next one starts, and
 * mobile browsers can suspend a page in the background at that moment, so
 * `StreamSpeechQueue` is used wherever Media Source Extensions can play MP3.
 * This queue covers the browsers that cannot.
 *
 * Framework-free on purpose: fetching, playback and ending call each other,
 * which a class expresses directly. `useServerSpeech` binds it to React.
 */

export const PREFETCH_AHEAD = 2;
export const MAX_IN_FLIGHT = 2;

type Clip =
  | { status: "loading"; controller: AbortController }
  | { status: "ready"; url: string }
  | { status: "failed" };

// "ranDry" means playback stopped because it reached the last retained
// sentence, so the next enqueue() resumes it.
type Playback = "idle" | "playing" | "ranDry";

export interface ServerSpeechSnapshot {
  activeIndex: number | undefined;
  buffering: boolean;
  error: boolean;
  paused: boolean;
  rate: number;
  speaking: boolean;
}

export const INITIAL_SERVER_SPEECH_SNAPSHOT: ServerSpeechSnapshot = {
  activeIndex: undefined,
  buffering: false,
  error: false,
  paused: false,
  rate: 1,
  speaking: false,
};

/** What `useServerSpeech` drives, whichever way the clips are played. */
export interface SpeechQueue {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ServerSpeechSnapshot;
  enqueue: (sentence: string) => void;
  /** No more sentences will be enqueued. */
  finish: () => void;
  playFrom: (index: number) => void;
  pause: () => void;
  resume: () => void;
  setRate: (rate: number) => void;
  /** Stops playback and releases every request and clip. Sentences are kept. */
  dispose: () => void;
}

/** Requests one sentence's audio. Rejects unless the service answered with it. */
export const requestSpeech = async (
  articleId: number | undefined,
  text: string,
  signal: AbortSignal,
) => {
  const response = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articleId, text }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Speech request failed with ${response.status}`);
  }
  return response;
};

export class ServerSpeechQueue implements SpeechQueue {
  private readonly articleId: number | undefined;
  private sentences: string[] = [];
  private clips = new Map<number, Clip>();
  // The sentence playing, or the one playback is waiting for.
  private position = 0;
  private playback: Playback = "idle";
  // True while the clip at `position` is still loading.
  private waiting = false;
  // The object URL assigned to the element for `position`. Media events only
  // count while the element still plays it, so a late event from a clip that
  // has since been replaced or left behind is ignored.
  private elementUrl: string | undefined;
  private element: HTMLAudioElement | undefined;
  private snapshot = INITIAL_SERVER_SPEECH_SNAPSHOT;
  private listeners = new Set<() => void>();

  /** Without an article id, the text is read as English. */
  constructor(articleId?: number) {
    this.articleId = articleId;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  enqueue = (sentence: string) => {
    this.sentences.push(sentence);

    if (this.playback === "ranDry") {
      this.playback = "playing";
      this.update({ speaking: true });
      this.playCurrent();
      return;
    }

    if (this.playback === "playing") {
      this.prefetch();
    }
  };

  // Each clip plays on its own, so the end of the text changes nothing.
  finish = () => {};

  playFrom = (index: number) => {
    this.element?.pause();

    // A failed clip is retried, and requests the new window does not need are
    // dropped so they do not hold up the ones it does.
    for (const [clipIndex, clip] of this.clips) {
      if (clip.status === "failed") {
        this.clips.delete(clipIndex);
      } else if (
        clip.status === "loading" &&
        (clipIndex < index || clipIndex > index + PREFETCH_AHEAD)
      ) {
        clip.controller.abort();
        this.clips.delete(clipIndex);
      }
    }

    this.position = index;
    this.elementUrl = undefined;
    this.playback = "playing";
    this.update({
      activeIndex: undefined,
      error: false,
      paused: false,
      speaking: true,
    });
    this.playCurrent();
  };

  pause = () => {
    this.element?.pause();
    this.update({ paused: true });
  };

  resume = () => {
    if (this.snapshot.error) {
      const failed = this.clips.get(this.position);
      if (failed?.status === "ready") URL.revokeObjectURL(failed.url);
      this.clips.delete(this.position);
      // playFrom also clears the other failed clips, so one press retries
      // every sentence that failed.
      this.playFrom(this.position);
      return;
    }

    this.update({ paused: false });

    // While waiting, the clip starts itself when it arrives.
    if (this.playback === "playing" && !this.waiting) {
      this.startElement();
    }
  };

  setRate = (rate: number) => {
    if (this.element) {
      // Loading a new src resets playbackRate to defaultPlaybackRate, so both
      // are set to carry the rate across clips.
      this.element.defaultPlaybackRate = rate;
      this.element.playbackRate = rate;
    }
    this.update({ rate });
  };

  dispose = () => {
    this.playback = "idle";
    this.waiting = false;
    this.elementUrl = undefined;
    this.element?.pause();

    for (const clip of this.clips.values()) {
      if (clip.status === "loading") clip.controller.abort();
      if (clip.status === "ready") URL.revokeObjectURL(clip.url);
    }
    this.clips.clear();

    this.update({ activeIndex: undefined, buffering: false, speaking: false });
  };

  private update(patch: Partial<ServerSpeechSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private audio() {
    if (!this.element) {
      const element = new Audio();
      element.defaultPlaybackRate = this.snapshot.rate;
      element.playbackRate = this.snapshot.rate;
      element.addEventListener("playing", this.handlePlaying);
      element.addEventListener("ended", this.handleEnded);
      element.addEventListener("error", this.handleElementError);
      this.element = element;
    }
    return this.element;
  }

  private isCurrentClip() {
    return (
      this.elementUrl !== undefined && this.element?.src === this.elementUrl
    );
  }

  private handlePlaying = () => {
    if (this.playback === "playing" && this.isCurrentClip()) {
      this.update({ activeIndex: this.position });
    }
  };

  private handleEnded = () => {
    if (this.playback !== "playing" || !this.isCurrentClip()) return;
    this.elementUrl = undefined;
    this.position += 1;
    this.playCurrent();
  };

  // A clip the browser cannot decode stops playback like a failed request.
  private handleElementError = () => {
    if (this.playback === "playing" && this.isCurrentClip()) this.fail();
  };

  private playCurrent() {
    if (this.playback !== "playing") return;

    if (this.position >= this.sentences.length) {
      this.waiting = false;
      this.playback = "ranDry";
      this.update({
        activeIndex: undefined,
        buffering: false,
        speaking: false,
      });
      return;
    }

    this.prefetch();

    const clip = this.clips.get(this.position);
    if (clip?.status === "failed") {
      this.fail();
      return;
    }
    if (clip?.status !== "ready") {
      this.waiting = true;
      this.update({ buffering: true });
      return;
    }

    this.waiting = false;
    this.update({ buffering: false });

    const element = this.audio();
    element.src = clip.url;
    this.elementUrl = clip.url;
    element.playbackRate = this.snapshot.rate;

    if (!this.snapshot.paused) {
      this.startElement();
    }
  }

  private startElement() {
    this.audio()
      .play()
      .catch((error: unknown) => {
        // Autoplay is blocked until the reader interacts with the page, as on
        // a reload. Waiting for the Play button is the expected outcome, not
        // an error. An AbortError is play() being interrupted by a newer src or
        // a pause, which needs nothing. A source the browser cannot decode
        // rejects with NotSupportedError, which the element's error event
        // handles.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          this.update({ paused: true });
        }
      });
  }

  private fail() {
    this.waiting = false;
    this.update({ buffering: false, error: true, paused: true });
  }

  private prefetch() {
    const last = Math.min(
      this.position + PREFETCH_AHEAD,
      this.sentences.length - 1,
    );

    // The clip playback is waiting for is never held back by look-ahead: when
    // the cap is full, the farthest look-ahead request makes room for it.
    if (this.position <= last && !this.clips.has(this.position)) {
      if (this.inFlight() >= MAX_IN_FLIGHT) this.dropFarthestLoading();
      this.request(this.position);
    }

    for (let index = this.position + 1; index <= last; index++) {
      if (this.inFlight() >= MAX_IN_FLIGHT) return;
      if (!this.clips.has(index)) this.request(index);
    }
  }

  private dropFarthestLoading() {
    let farthest: number | undefined;
    for (const [index, clip] of this.clips) {
      if (
        clip.status === "loading" &&
        (farthest === undefined || index > farthest)
      ) {
        farthest = index;
      }
    }
    const clip = farthest === undefined ? undefined : this.clips.get(farthest);
    if (clip?.status === "loading") {
      clip.controller.abort();
      this.clips.delete(farthest!);
    }
  }

  private inFlight() {
    let count = 0;
    for (const clip of this.clips.values()) {
      if (clip.status === "loading") count += 1;
    }
    return count;
  }

  private request(index: number) {
    const controller = new AbortController();
    const entry: Clip = { status: "loading", controller };
    this.clips.set(index, entry);

    // A dropped or disposed request no longer owns its slot. Checking identity
    // rather than the abort signal also catches a response that raced the
    // abort, before an object URL is created for it.
    const current = () => this.clips.get(index) === entry;

    requestSpeech(this.articleId, this.sentences[index], controller.signal)
      .then((response) => response.blob())
      .then(
        (blob) => {
          if (!current()) return;
          this.settle(index, {
            status: "ready",
            url: URL.createObjectURL(blob),
          });
        },
        () => {
          if (!current()) return;
          this.settle(index, { status: "failed" });
        },
      );
  }

  private settle(index: number, clip: Clip) {
    this.clips.set(index, clip);

    if (this.waiting && index === this.position) {
      this.playCurrent();
    } else if (this.playback === "playing") {
      this.prefetch();
    }
  }
}
