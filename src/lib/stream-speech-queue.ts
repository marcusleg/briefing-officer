/**
 * Plays text through a TTS service behind /api/speech as one
 * continuous stream.
 *
 * Sentences are synthesized one at a time, as in `ServerSpeechQueue`, but each
 * clip is appended to a single MediaSource instead of becoming its own source.
 * The <audio> element therefore plays one unbroken track: it never ends between
 * sentences, and a sentence that is still loading only makes it wait. Mobile
 * browsers keep a page in the background running while its media plays and
 * may suspend it once the media stops, so this is what lets the reading go on
 * with the screen off or in another app.
 *
 * Clips are appended strictly in order, so the stream always holds a run of
 * sentences without gaps, starting at the sentence it was opened for.
 */

import { MP3_IN_MP4_TYPES, Mp3Fmp4Muxer } from "@/lib/mp3-fmp4";
import {
  INITIAL_SERVER_SPEECH_SNAPSHOT,
  MAX_IN_FLIGHT,
  PREFETCH_AHEAD,
  requestSpeech,
  type ServerSpeechSnapshot,
  type SpeechQueue,
} from "@/lib/server-speech-queue";

// How close to the end of the buffered audio a stall counts as having run out,
// rather than a seek or decoder hiccup the element recovers from on its own.
const END_TOLERANCE_SECONDS = 0.1;

/** How clips reach the SourceBuffer. */
export interface StreamFormat {
  /** The SourceBuffer's MIME type. */
  type: string;
  /** Returns a converter for one stream, from MP3 clips to the segments to append. */
  segmenter: () => (clip: Uint8Array) => Uint8Array[];
}

// Safari and every iOS browser run on WebKit, whose Media Source Extensions
// have not been tried with these streams, so they keep playing clip by clip.
// Blink browsers also name AppleWebKit, but add Chrome or Chromium.
const isWebKit = () =>
  typeof navigator !== "undefined" &&
  /AppleWebKit\//.test(navigator.userAgent) &&
  !/(Chrome|Chromium)\//.test(navigator.userAgent);

/**
 * The way this browser can stream MP3 through Media Source Extensions, or
 * undefined when it cannot or should not. Chromium takes MP3 as it is; Firefox
 * needs it repackaged as MP4.
 */
export const findStreamFormat = (): StreamFormat | undefined => {
  if (typeof MediaSource === "undefined" || isWebKit()) return undefined;

  if (MediaSource.isTypeSupported("audio/mpeg")) {
    return { type: "audio/mpeg", segmenter: () => (clip) => [clip] };
  }

  const type = MP3_IN_MP4_TYPES.find((candidate) =>
    MediaSource.isTypeSupported(candidate),
  );
  if (!type) return undefined;

  return {
    type,
    segmenter: () => {
      const muxer = new Mp3Fmp4Muxer();
      return (clip) => muxer.segments(clip);
    },
  };
};

type Clip =
  | { status: "loading"; controller: AbortController }
  | { status: "ready"; bytes: Uint8Array }
  | { status: "failed" };

// "ranDry" means playback stopped because it reached the last retained
// sentence, so the next enqueue() resumes it.
type Playback = "idle" | "playing" | "ranDry";

interface Stream {
  /** The sentence the stream starts with. */
  base: number;
  /** Where each appended sentence sits on the media timeline, from `base`. */
  bounds: { start: number; end: number }[];
  /** Set by a decode or append error; the next playFrom() opens a new stream. */
  broken: boolean;
  buffer: SourceBuffer | undefined;
  /** The sentence being appended, while its segments go in one by one. */
  appending: number | undefined;
  pending: Uint8Array[];
  segment: (clip: Uint8Array) => Uint8Array[];
  source: MediaSource;
  url: string;
}

export class StreamSpeechQueue implements SpeechQueue {
  private readonly articleId: number | undefined;
  private readonly format: StreamFormat;
  private sentences: string[] = [];
  // Clips not yet appended. An appended clip lives on in the SourceBuffer.
  private clips = new Map<number, Clip>();
  private stream: Stream | undefined;
  // The sentence playing, or the one playback is waiting for.
  private position = 0;
  private playback: Playback = "idle";
  // A sentence playFrom() asked for that is not in the stream yet. Playback
  // seeks to it once it is appended.
  private target: number | undefined;
  // True while the element has played everything appended and waits for more.
  private starved = false;
  // Set once the whole text has been enqueued.
  private finished = false;
  private element: HTMLAudioElement | undefined;
  private snapshot = INITIAL_SERVER_SPEECH_SNAPSHOT;
  private listeners = new Set<() => void>();

  /** Without an article id, the text is read as English. */
  constructor(articleId: number | undefined, format: StreamFormat) {
    this.articleId = articleId;
    this.format = format;
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
      this.position = this.appendedEnd();
      this.update({ buffering: true, speaking: true });
    }

    if (this.playback === "playing") {
      this.prefetch();
    }
  };

  finish = () => {
    this.finished = true;
    this.endIfComplete();
  };

  playFrom = (index: number) => {
    // A failed clip is retried, and requests the new window does not need are
    // dropped so they do not hold up the ones it does. Clips before the window
    // stay: the stream needs every sentence up to it.
    for (const [clipIndex, clip] of this.clips) {
      if (clip.status === "failed") {
        this.clips.delete(clipIndex);
      } else if (
        clip.status === "loading" &&
        clipIndex > index + PREFETCH_AHEAD
      ) {
        clip.controller.abort();
        this.clips.delete(clipIndex);
      }
    }

    // A stream cannot hold sentences before the one it started with, and a
    // broken one cannot be appended to, so either needs replacing.
    if (!this.stream || this.stream.broken || index < this.stream.base) {
      this.closeStream();
      this.openStream(index);
      for (const [clipIndex, clip] of this.clips) {
        if (clipIndex >= index) continue;
        if (clip.status === "loading") clip.controller.abort();
        this.clips.delete(clipIndex);
      }
    }

    this.playback = "playing";
    this.position = index;
    this.update({
      activeIndex: undefined,
      error: false,
      paused: false,
      speaking: true,
    });

    if (index >= this.sentences.length) {
      this.playback = "ranDry";
      this.target = undefined;
      this.starved = true;
      this.update({ buffering: false, speaking: false });
      return;
    }

    const stream = this.stream!;
    const bound = stream.bounds[index - stream.base];
    if (bound) {
      this.target = undefined;
      this.starved = false;
      this.audio().currentTime = bound.start;
      this.update({ buffering: false });
      this.startElement();
    } else {
      // Playback starts once the sentence is appended. Starting it now could
      // replay the stream from its beginning, since play() rewinds an element
      // that has reached its end.
      this.target = index;
      this.starved = true;
      this.update({ buffering: true });
    }

    this.prefetch();
    this.appendNext();
  };

  pause = () => {
    this.element?.pause();
    this.update({ paused: true });
  };

  resume = () => {
    if (this.snapshot.error) {
      // playFrom also clears the other failed clips, so one press retries
      // every sentence that failed.
      this.playFrom(this.position);
      return;
    }

    this.update({ paused: false });
    if (this.playback === "playing") this.startElement();
  };

  setRate = (rate: number) => {
    if (this.element) {
      this.element.defaultPlaybackRate = rate;
      this.element.playbackRate = rate;
    }
    this.update({ rate });
  };

  dispose = () => {
    this.playback = "idle";
    this.target = undefined;
    this.starved = false;

    for (const clip of this.clips.values()) {
      if (clip.status === "loading") clip.controller.abort();
    }
    this.clips.clear();
    this.closeStream();

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
      element.addEventListener("timeupdate", this.handleTimeUpdate);
      element.addEventListener("waiting", this.handleWaiting);
      element.addEventListener("ended", this.handleEnded);
      element.addEventListener("play", this.handlePlay);
      element.addEventListener("pause", this.handlePause);
      element.addEventListener("error", this.handleError);
      this.element = element;
    }
    return this.element;
  }

  /** The sentence after the last one appended. */
  private appendedEnd() {
    return this.stream ? this.stream.base + this.stream.bounds.length : 0;
  }

  private openStream(base: number) {
    const source = new MediaSource();
    const stream: Stream = {
      appending: undefined,
      base,
      bounds: [],
      broken: false,
      buffer: undefined,
      pending: [],
      segment: this.format.segmenter(),
      source,
      url: URL.createObjectURL(source),
    };
    this.stream = stream;

    source.addEventListener(
      "sourceopen",
      () => {
        if (this.stream !== stream) return;
        try {
          const buffer = source.addSourceBuffer(this.format.type);
          // Each segment follows the one before, whatever timestamps it has.
          buffer.mode = "sequence";
          buffer.addEventListener("updateend", () =>
            this.handleUpdateEnd(stream),
          );
          buffer.addEventListener("error", () => this.breakStream(stream));
          stream.buffer = buffer;
        } catch {
          this.breakStream(stream);
          return;
        }
        this.appendNext();
      },
      { once: true },
    );

    const element = this.audio();
    element.src = stream.url;
    // Loading a new src resets playbackRate to defaultPlaybackRate.
    element.playbackRate = this.snapshot.rate;
  }

  private closeStream() {
    const stream = this.stream;
    if (!stream) return;
    this.stream = undefined;
    this.element?.pause();
    this.element?.removeAttribute("src");
    this.element?.load();
    URL.revokeObjectURL(stream.url);
  }

  /** Whether the element still plays the current stream. */
  private playsStream() {
    return this.stream !== undefined && this.element?.src === this.stream.url;
  }

  private isCurrent() {
    return this.playback === "playing" && this.playsStream();
  }

  /** The appended sentence at `time` on the media timeline. */
  private indexAt(time: number) {
    const stream = this.stream;
    if (!stream) return undefined;
    for (let offset = stream.bounds.length - 1; offset >= 0; offset--) {
      if (stream.bounds[offset].start <= time) return stream.base + offset;
    }
    return undefined;
  }

  private handlePlaying = () => {
    if (!this.isCurrent()) return;
    this.starved = false;
    this.track();
  };

  private handleTimeUpdate = () => {
    if (this.isCurrent()) this.track();
  };

  /** Follows the element from sentence to sentence. */
  private track() {
    if (this.target !== undefined || this.starved || this.element!.paused) {
      return;
    }
    const index = this.indexAt(this.element!.currentTime);
    if (index === undefined) return;

    if (index !== this.snapshot.activeIndex || this.snapshot.buffering) {
      this.update({ activeIndex: index, buffering: false });
    }
    if (index !== this.position) {
      this.position = index;
      this.prefetch();
    }
  }

  // Only shows the spinner. Browsers do not reliably report running out of
  // data, so the end of what can be played is signaled by ending the stream.
  private handleWaiting = () => {
    if (!this.isCurrent() || this.snapshot.error) return;
    const end = this.stream!.bounds.at(-1)?.end ?? 0;
    if (
      this.target === undefined &&
      this.element!.currentTime < end - END_TOLERANCE_SECONDS
    ) {
      return;
    }
    this.starved = true;
    this.update({ buffering: true });
  };

  // The stream is ended once it cannot grow: the whole text is in it, or the
  // next sentence failed. Until then the element waits at the end of what it
  // has rather than stopping, because a mobile browser may not let a page in
  // the background start it again. A retried sentence reopens the stream.
  private handleEnded = () => {
    // A seek or replay since the event was queued has overtaken it.
    if (!this.isCurrent() || !this.element!.ended) return;

    this.starved = true;
    const next = this.appendedEnd();
    this.position = next;
    // Resuming an element that has ended would rewind it to the start, so it
    // seeks to the next sentence explicitly once that is appended.
    this.target = next;

    if (this.clips.get(next)?.status === "failed") {
      this.fail();
    } else if (next >= this.sentences.length) {
      this.playback = "ranDry";
      this.update({
        activeIndex: undefined,
        buffering: false,
        speaking: false,
      });
    } else {
      this.update({ buffering: true });
    }
  };

  /** Ends the stream when nothing more can be appended for now. */
  private endIfComplete() {
    const stream = this.stream;
    if (
      !stream?.buffer ||
      stream.broken ||
      stream.appending !== undefined ||
      stream.buffer.updating ||
      stream.source.readyState !== "open"
    ) {
      return;
    }
    const next = this.appendedEnd();
    if (
      (this.finished && next >= this.sentences.length) ||
      this.clips.get(next)?.status === "failed"
    ) {
      try {
        stream.source.endOfStream();
      } catch {
        // Ending is only a signal; playback carries on without it.
      }
    }
  }

  // The element can be paused and played from outside the page, such as the
  // media notification Android shows while it plays. Checking the element's
  // own state skips an event that a later call has already overtaken.
  private handlePause = () => {
    if (
      this.isCurrent() &&
      this.element!.paused &&
      // Reaching the end pauses the element too, which handleEnded handles.
      !this.element!.ended &&
      !this.snapshot.paused &&
      !this.snapshot.error
    ) {
      this.update({ paused: true });
    }
  };

  private handlePlay = () => {
    if (!this.playsStream() || this.element!.paused) return;

    // Playing an element that has ended starts it over, so the text
    // replays from its first sentence.
    if (this.playback === "ranDry" && !this.snapshot.error) {
      this.playback = "playing";
      this.position = this.stream!.base;
      this.target = undefined;
      this.starved = false;
      this.update({
        activeIndex: undefined,
        buffering: false,
        paused: false,
        speaking: true,
      });
      return;
    }

    // The stream holds no more than what played before the failure, so the
    // element is held until the reader retries from the page.
    if (this.snapshot.error) {
      this.element!.pause();
      return;
    }

    if (this.playback === "playing" && this.snapshot.paused) {
      this.update({ paused: false });
    }
  };

  // Audio the browser cannot decode stops playback like a failed request.
  private handleError = () => {
    if (this.isCurrent()) this.breakStream(this.stream!);
  };

  private breakStream(stream: Stream) {
    if (this.stream !== stream) return;
    stream.broken = true;
    // The clip being appended is the likely culprit, so it is fetched again.
    if (stream.appending !== undefined) this.clips.delete(stream.appending);
    if (this.playback !== "idle") {
      this.playback = "playing";
      this.update({ speaking: true });
      this.fail();
    }
  }

  private startElement() {
    this.audio()
      .play()
      .catch((error: unknown) => {
        // Autoplay is blocked until the reader interacts with the page, as on
        // a reload. Waiting for the Play button is the expected outcome, not
        // an error. An AbortError is play() being interrupted by a newer src or
        // a pause, which needs nothing.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          this.update({ paused: true });
        }
      });
  }

  private fail() {
    this.element?.pause();
    this.update({ buffering: false, error: true, paused: true });
  }

  private appendNext() {
    const stream = this.stream;
    if (
      !stream?.buffer ||
      stream.broken ||
      stream.appending !== undefined ||
      stream.buffer.updating
    ) {
      return;
    }

    const index = this.appendedEnd();
    const clip = this.clips.get(index);
    if (clip?.status !== "ready") return;

    let segments: Uint8Array[];
    try {
      segments = stream.segment(clip.bytes);
    } catch {
      this.settle(index, { status: "failed" });
      return;
    }

    stream.appending = index;
    stream.pending = segments;
    this.appendPending(stream);
  }

  private appendPending(stream: Stream) {
    const segment = stream.pending.shift();
    if (!segment) {
      this.completeAppend(stream);
      return;
    }
    try {
      stream.buffer!.appendBuffer(segment as Uint8Array<ArrayBuffer>);
    } catch {
      this.breakStream(stream);
    }
  }

  private handleUpdateEnd(stream: Stream) {
    if (this.stream !== stream || stream.broken) return;
    if (stream.appending !== undefined) this.appendPending(stream);
  }

  private completeAppend(stream: Stream) {
    const index = stream.appending!;
    stream.appending = undefined;
    this.clips.delete(index);

    const ranges = stream.buffer!.buffered;
    const end = ranges.length > 0 ? ranges.end(ranges.length - 1) : 0;
    const start =
      stream.bounds.at(-1)?.end ?? (ranges.length > 0 ? ranges.start(0) : 0);
    stream.bounds.push({ start, end });

    if (this.target !== undefined && this.target < this.appendedEnd()) {
      const bound = stream.bounds[this.target - stream.base];
      this.position = this.target;
      this.target = undefined;
      this.audio().currentTime = bound.start;
    }

    // Whatever playback was waiting for is in the stream now, even if it stays
    // paused.
    if (this.starved && this.target === undefined) {
      this.starved = false;
      this.update({ buffering: false });
    }

    // Playback waiting for its first sentence, or one that reached the end of
    // the stream, is not running, so the sentence it waited for starts it.
    if (
      this.playback === "playing" &&
      this.target === undefined &&
      !this.snapshot.paused &&
      this.element?.paused
    ) {
      this.startElement();
    }

    this.prefetch();
    this.appendNext();
    this.endIfComplete();
  }

  private prefetch() {
    if (this.playback !== "playing") return;

    const first = this.appendedEnd();
    const last = Math.min(
      this.position + PREFETCH_AHEAD,
      this.sentences.length - 1,
    );

    // The sentence the stream needs next is never held back by look-ahead:
    // when the cap is full, the farthest request makes room for it.
    if (first <= last && !this.clips.has(first)) {
      if (this.inFlight() >= MAX_IN_FLIGHT) this.dropFarthestLoading();
      this.request(first);
    }

    for (let index = first + 1; index <= last; index++) {
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

    // A dropped or disposed request no longer owns its slot, even when its
    // response raced the abort.
    const current = () => this.clips.get(index) === entry;

    requestSpeech(this.articleId, this.sentences[index], controller.signal)
      .then((response) => response.arrayBuffer())
      .then(
        (buffer) => {
          if (current()) {
            this.settle(index, {
              status: "ready",
              bytes: new Uint8Array(buffer),
            });
          }
        },
        () => {
          if (current()) this.settle(index, { status: "failed" });
        },
      );
  }

  private settle(index: number, clip: Clip) {
    this.clips.set(index, clip);

    if (clip.status === "ready") {
      this.appendNext();
    } else if (index === this.appendedEnd()) {
      if (this.playback === "playing" && this.starved) {
        // Playback is waiting for exactly this sentence, so a retry starts
        // there rather than replaying the one before.
        this.position = index;
        this.fail();
        return;
      }
      // Playback stops with an error once it reaches the end of the stream.
      this.endIfComplete();
    }

    this.prefetch();
  }
}
