import { useServerSpeech } from "@/hooks/use-server-speech";
import { MP3_IN_MP4_TYPES } from "@/lib/mp3-fmp4";
import { findStreamFormat, StreamSpeechQueue } from "@/lib/stream-speech-queue";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHROME_ANDROID_UA,
  CHROME_IPAD_UA,
  FakeStreamAudio,
  installStreamSpeech,
  passthroughFormat,
  SAFARI_MAC_UA,
} from "../../helpers/stream-speech";

afterEach(() => vi.unstubAllGlobals());

type Speech = ReturnType<typeof installStreamSpeech>;

/** Lets fetches, appends and media events run to completion. */
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const respond = async (speech: Speech, text: string) => {
  speech.requests
    .filter((request) => request.text === text && !request.settled)
    .at(-1)!
    .respond();
  await flush();
};

const fail = async (speech: Speech, text: string) => {
  speech.requests
    .filter((request) => request.text === text && !request.settled)
    .at(-1)!
    .fail();
  await flush();
};

const startPlayback = async (sentences: string[]) => {
  const speech = installStreamSpeech();
  const queue = new StreamSpeechQueue(42, passthroughFormat);
  for (const sentence of sentences) queue.enqueue(sentence);
  queue.playFrom(0);
  await flush();
  return { speech, queue, state: () => queue.getSnapshot() };
};

describe("StreamSpeechQueue", () => {
  it("appends every clip to one stream, in order, whatever order they arrive in", async () => {
    const { speech } = await startPlayback(["One.", "Two."]);

    await respond(speech, "Two.");
    expect(speech.appended()).toEqual([]);

    await respond(speech, "One.");
    expect(speech.appended()).toEqual(["One.", "Two."]);
    expect(speech.audio().src).toBe("blob:media-source-1");
    expect(FakeStreamAudio.instances).toHaveLength(1);
    expect(speech.source().buffer!.mode).toBe("sequence");
  });

  it("buffers until the first clip is appended, then starts playing", async () => {
    const { speech, state } = await startPlayback(["One."]);
    expect(state().buffering).toBe(true);
    expect(speech.audio().play).not.toHaveBeenCalled();

    await respond(speech, "One.");

    expect(state().buffering).toBe(false);
    expect(speech.audio().paused).toBe(false);
    expect(state().activeIndex).toBe(0);
    expect(state().speaking).toBe(true);
  });

  it("highlights the sentence at the playback position", async () => {
    const { speech, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    await respond(speech, "Two.");

    speech.audio().advanceTo(0.5);
    expect(state().activeIndex).toBe(0);

    speech.audio().advanceTo(1.5);
    expect(state().activeIndex).toBe(1);
  });

  it("keeps two requests in flight and fills a window of two ahead", async () => {
    const { speech } = await startPlayback(["One.", "Two.", "Three.", "Four."]);
    expect(speech.requested()).toEqual(["One.", "Two."]);

    await respond(speech, "One.");
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    await respond(speech, "Two.");
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    speech.audio().advanceTo(1.2);
    expect(speech.requested()).toEqual(["One.", "Two.", "Three.", "Four."]);
  });

  it("ends the stream once the whole script is in it and stops at its end", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    await respond(speech, "One.");
    expect(speech.source().endOfStream).not.toHaveBeenCalled();

    queue.finish();
    expect(speech.source().endOfStream).toHaveBeenCalledOnce();

    speech.audio().playToEnd();

    expect(state().speaking).toBe(false);
    expect(state().paused).toBe(false);
    expect(state().activeIndex).toBeUndefined();
  });

  it("does not end the stream while sentences are still loading", async () => {
    const { speech, queue } = await startPlayback(["One.", "Two."]);
    queue.finish();
    await respond(speech, "One.");

    expect(speech.source().endOfStream).not.toHaveBeenCalled();

    await respond(speech, "Two.");
    expect(speech.source().endOfStream).toHaveBeenCalledOnce();
  });

  it("waits without pausing for a sentence the script has not reached yet", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    await respond(speech, "One.");

    speech.audio().playToEnd();
    expect(speech.audio().paused).toBe(false);
    expect(state().speaking).toBe(true);
    expect(state().buffering).toBe(true);

    queue.enqueue("Two.");
    await respond(speech, "Two.");

    expect(speech.appended()).toEqual(["One.", "Two."]);
    expect(speech.audio().play).toHaveBeenCalledOnce();
    expect(state().buffering).toBe(false);
    expect(state().activeIndex).toBe(1);
  });

  it("continues where it stopped when a sentence arrives after the end", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    await respond(speech, "One.");
    queue.finish();
    speech.audio().playToEnd();
    expect(state().speaking).toBe(false);

    queue.enqueue("Two.");
    expect(state().speaking).toBe(true);
    await respond(speech, "Two.");

    expect(speech.appended()).toEqual(["One.", "Two."]);
    expect(speech.audio().currentTime).toBe(1);
    expect(speech.audio().paused).toBe(false);
    expect(state().activeIndex).toBe(1);
    expect(FakeStreamAudio.instances).toHaveLength(1);
  });

  it("shows the spinner while it waits for the next clip", async () => {
    const { speech, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");

    speech.audio().playToEnd();
    expect(state().buffering).toBe(true);

    await respond(speech, "Two.");
    expect(state().buffering).toBe(false);
    expect(state().activeIndex).toBe(1);
  });

  it("replays from the start by seeking, without requesting again", async () => {
    const { speech, queue, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    await respond(speech, "Two.");
    speech.audio().playToEnd();

    queue.playFrom(0);
    await flush();

    expect(speech.audio().currentTime).toBe(0);
    expect(speech.audio().paused).toBe(false);
    expect(state().speaking).toBe(true);
    expect(speech.fetch).toHaveBeenCalledTimes(2);
    expect(speech.createObjectURL).toHaveBeenCalledOnce();
  });

  it("changes speed on the one element", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    await respond(speech, "One.");

    queue.setRate(1.5);

    expect(state().rate).toBe(1.5);
    expect(speech.audio().playbackRate).toBe(1.5);
  });

  it("applies a rate set before playback", async () => {
    const speech = installStreamSpeech();
    const queue = new StreamSpeechQueue(42, passthroughFormat);
    queue.setRate(1.2);
    queue.enqueue("One.");
    queue.playFrom(0);
    await respond(speech, "One.");

    expect(speech.audio().playbackRate).toBe(1.2);
  });

  it("pauses and resumes", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    await respond(speech, "One.");

    queue.pause();
    expect(speech.audio().paused).toBe(true);
    expect(state().paused).toBe(true);

    queue.resume();
    expect(speech.audio().paused).toBe(false);
    expect(state().paused).toBe(false);
  });

  it("does not start a clip that arrives while paused", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    queue.pause();

    await respond(speech, "One.");

    expect(speech.audio().play).not.toHaveBeenCalled();
    expect(state().buffering).toBe(false);
  });

  it("follows a pause and play from outside the page", async () => {
    const { speech, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");

    speech.audio().pause();
    expect(state().paused).toBe(true);

    await speech.audio().play();
    expect(state().paused).toBe(false);
  });

  it("replays from the start when played from outside the page after the end", async () => {
    const { speech, queue, state } = await startPlayback(["One.", "Two."]);
    queue.finish();
    await respond(speech, "One.");
    await respond(speech, "Two.");
    speech.audio().playToEnd();
    expect(state().speaking).toBe(false);

    await speech.audio().play();

    expect(speech.audio().currentTime).toBe(0);
    expect(state()).toMatchObject({
      activeIndex: 0,
      paused: false,
      speaking: true,
    });

    speech.audio().advanceTo(1.5);
    expect(state().activeIndex).toBe(1);
  });

  it("holds the element when played from outside the page after a failure", async () => {
    const { speech, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    await fail(speech, "Two.");
    speech.audio().playToEnd();
    expect(state().error).toBe(true);

    await speech.audio().play();

    expect(speech.audio().paused).toBe(true);
    expect(state()).toMatchObject({
      buffering: false,
      error: true,
      paused: true,
    });
  });

  it("ignores an end that a replay has overtaken", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    queue.finish();
    await respond(speech, "One.");
    speech.audio().playToEnd();

    queue.playFrom(0);
    // An "ended" event queued before the replay arrives after it.
    speech.audio().dispatchEvent(new Event("ended"));

    expect(state().speaking).toBe(true);
    speech.audio().advanceTo(0.5);
    expect(state().activeIndex).toBe(0);
  });

  it("waits for the reader when the browser blocks autoplay", async () => {
    const { speech, queue, state } = await startPlayback(["One."]);
    FakeStreamAudio.rejectNextPlay = "NotAllowedError";

    await respond(speech, "One.");
    expect(state().paused).toBe(true);
    expect(state().error).toBe(false);

    queue.resume();
    await flush();
    expect(speech.audio().paused).toBe(false);
    expect(state().activeIndex).toBe(0);
  });

  it("stops at a sentence that could not be synthesized and retries it", async () => {
    const { speech, queue, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    await fail(speech, "Two.");

    // Playback goes on until it reaches the missing sentence.
    expect(state().error).toBe(false);
    expect(speech.source().endOfStream).toHaveBeenCalledOnce();

    speech.audio().playToEnd();
    expect(state().error).toBe(true);
    expect(state().paused).toBe(true);

    queue.resume();
    expect(state().error).toBe(false);
    expect(speech.requested().filter((text) => text === "Two.")).toHaveLength(
      2,
    );

    await respond(speech, "Two.");
    expect(speech.appended()).toEqual(["One.", "Two."]);
    expect(speech.audio().currentTime).toBe(1);
    expect(speech.audio().paused).toBe(false);
    expect(state().activeIndex).toBe(1);
  });

  it("retries the sentence it was waiting for, without replaying the one before", async () => {
    const { speech, queue, state } = await startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    speech.audio().playToEnd();

    await fail(speech, "Two.");
    expect(state().error).toBe(true);

    queue.resume();
    await respond(speech, "Two.");

    expect(speech.appended()).toEqual(["One.", "Two."]);
    expect(speech.audio().currentTime).toBe(1);
    expect(state().activeIndex).toBe(1);
  });

  it("reports a failure right away when playback is already waiting for it", async () => {
    const { speech, state } = await startPlayback(["One."]);

    await fail(speech, "One.");

    expect(state().error).toBe(true);
    expect(state().buffering).toBe(false);
  });

  it("opens a new stream from the current sentence after a decode error", async () => {
    const { speech, queue, state } = await startPlayback([
      "One.",
      "Two.",
      "Three.",
    ]);
    await respond(speech, "One.");
    await respond(speech, "Two.");
    speech.audio().advanceTo(1.5);

    speech.audio().breakStream();
    expect(state().error).toBe(true);

    queue.resume();
    await flush();

    expect(speech.createObjectURL).toHaveBeenCalledTimes(2);
    expect(speech.revokeObjectURL).toHaveBeenCalledWith("blob:media-source-1");
    // The new stream starts at the sentence that was playing.
    await respond(speech, "Two.");
    expect(speech.appended()).toEqual(["Two."]);
    expect(state().activeIndex).toBe(1);
  });

  it("fails a clip the format cannot convert", async () => {
    const speech = installStreamSpeech();
    const queue = new StreamSpeechQueue(42, {
      type: "audio/mpeg",
      segmenter: () => () => {
        throw new Error("No MP3 frames found.");
      },
    });
    queue.enqueue("One.");
    queue.playFrom(0);
    await flush();

    await respond(speech, "One.");

    expect(queue.getSnapshot().error).toBe(true);
  });

  it("aborts requests and releases the stream when disposed", async () => {
    const { speech, queue } = await startPlayback(["One.", "Two.", "Three."]);
    await respond(speech, "One.");

    queue.dispose();

    expect(speech.requests[1].signal.aborted).toBe(true);
    expect(speech.audio().paused).toBe(true);
    expect(speech.audio().removeAttribute).toHaveBeenCalledWith("src");
    expect(speech.revokeObjectURL).toHaveBeenCalledWith("blob:media-source-1");
  });

  it("plays after dispose and a replay, as Strict Mode and the player do", async () => {
    const speech = installStreamSpeech();
    const queue = new StreamSpeechQueue(42, passthroughFormat);

    queue.enqueue("One.");
    queue.playFrom(0);
    queue.dispose();
    queue.playFrom(0);
    await flush();

    expect(speech.requested()).toEqual(["One.", "One."]);
    await respond(speech, "One.");

    expect(speech.appended()).toEqual(["One."]);
    expect(queue.getSnapshot().activeIndex).toBe(0);
  });
});

describe("findStreamFormat", () => {
  it("streams MP3 as it is where the browser accepts it", () => {
    installStreamSpeech({ supportedTypes: ["audio/mpeg"] });

    const format = findStreamFormat()!;

    expect(format.type).toBe("audio/mpeg");
    const clip = new Uint8Array([1, 2, 3]);
    expect(format.segmenter()(clip)).toEqual([clip]);
  });

  it("repackages MP3 as MP4 where only that is accepted", () => {
    installStreamSpeech({ supportedTypes: [MP3_IN_MP4_TYPES[0]] });

    expect(findStreamFormat()?.type).toBe(MP3_IN_MP4_TYPES[0]);
  });

  it("streams in Chromium browsers, whose user agent also names AppleWebKit", () => {
    installStreamSpeech({ userAgent: CHROME_ANDROID_UA });

    expect(findStreamFormat()?.type).toBe("audio/mpeg");
  });

  it("keeps Safari and iOS browsers on clip-by-clip playback", () => {
    installStreamSpeech({ userAgent: SAFARI_MAC_UA });
    expect(findStreamFormat()).toBeUndefined();

    installStreamSpeech({ userAgent: CHROME_IPAD_UA });
    expect(findStreamFormat()).toBeUndefined();
  });

  it("finds nothing without Media Source Extensions or MP3 support", () => {
    installStreamSpeech({ supportedTypes: [] });
    expect(findStreamFormat()).toBeUndefined();

    vi.stubGlobal("MediaSource", undefined);
    expect(findStreamFormat()).toBeUndefined();
  });
});

describe("useServerSpeech", () => {
  it("streams where the browser can, and plays clip by clip elsewhere", async () => {
    const speech = installStreamSpeech();
    const { result } = renderHook(() => useServerSpeech(42));
    await act(async () => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
      await respond(speech, "One.");
    });
    expect(speech.appended()).toEqual(["One."]);

    vi.stubGlobal("MediaSource", undefined);
    const fallback = renderHook(() => useServerSpeech(42));
    await act(async () => {
      fallback.result.current.enqueue("Two.");
      fallback.result.current.playFrom(0);
      await respond(speech, "Two.");
    });
    // The clip-by-clip queue plays each response as its own object URL.
    expect(speech.createObjectURL).toHaveBeenLastCalledWith({ text: "Two." });
  });
});
