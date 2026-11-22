import { useServerSpeech } from "@/hooks/use-server-speech";
import { ServerSpeechQueue } from "@/lib/server-speech-queue";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeAudio, installServerSpeech } from "../../helpers/server-speech";

afterEach(() => vi.unstubAllGlobals());

type Speech = ReturnType<typeof installServerSpeech>;

/** Lets the fetch → blob → object URL chain run to completion. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** Answers the latest live request for `text`. */
const respond = async (speech: Speech, text: string) => {
  speech.requests
    .filter((request) => request.text === text && !request.settled)
    .at(-1)!
    .respond();
  await settle();
};

const fail = async (speech: Speech, text: string) => {
  speech.requests
    .filter((request) => request.text === text && !request.settled)
    .at(-1)!
    .fail();
  await settle();
};

const finish = async (speech: Speech) => {
  act(() => speech.audio().finish());
  await settle();
};

const startPlayback = (
  sentences: string[],
  options?: Parameters<typeof installServerSpeech>[0],
) => {
  const speech = installServerSpeech(options);
  const rendered = renderHook(() => useServerSpeech(42));

  act(() => {
    for (const sentence of sentences) {
      rendered.result.current.enqueue(sentence);
    }
    rendered.result.current.playFrom(0);
  });

  return { speech, ...rendered };
};

describe("useServerSpeech", () => {
  it("reports itself as supported with a voice", () => {
    installServerSpeech();
    const { result } = renderHook(() => useServerSpeech(42));

    expect(result.current.supported).toBe(true);
    expect(result.current.voiceAvailable).toBe(true);
  });

  it("sends no article id when it reads text without an article", () => {
    const speech = installServerSpeech();
    const { result } = renderHook(() => useServerSpeech());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    const init = speech.fetch.mock.calls[0][1];
    expect(JSON.parse(init.body as string)).toEqual({ text: "One." });
  });

  it("does not request anything before playback starts", () => {
    const speech = installServerSpeech();
    const { result } = renderHook(() => useServerSpeech(42));

    act(() => result.current.enqueue("One."));

    expect(speech.fetch).not.toHaveBeenCalled();
  });

  it("posts each sentence with the article id to the speech route", () => {
    const { speech } = startPlayback(["One."]);

    expect(speech.fetch).toHaveBeenCalledWith(
      "/api/speech",
      expect.objectContaining({ method: "POST" }),
    );
    expect(speech.requests[0]).toMatchObject({ articleId: 42, text: "One." });
  });

  it("keeps two requests in flight and fills a window of two ahead", async () => {
    const { speech } = startPlayback(["One.", "Two.", "Three.", "Four."]);

    expect(speech.requested()).toEqual(["One.", "Two."]);

    await respond(speech, "One.");
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    await respond(speech, "Two.");
    // The window is the playing sentence plus two, so "Four." waits until
    // "One." has finished.
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    await finish(speech);
    expect(speech.requested()).toEqual(["One.", "Two.", "Three.", "Four."]);
  });

  it("plays the clips in order and highlights the one playing", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);

    await respond(speech, "One.");
    expect(speech.audio().src).toBe("blob:One.");
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.speaking).toBe(true);

    await respond(speech, "Two.");
    await finish(speech);
    expect(speech.audio().src).toBe("blob:Two.");
    expect(result.current.activeIndex).toBe(1);
  });

  it("buffers while the next clip is still loading", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);
    expect(result.current.buffering).toBe(true);

    await respond(speech, "One.");
    expect(result.current.buffering).toBe(false);

    await finish(speech);
    expect(result.current.buffering).toBe(true);

    await respond(speech, "Two.");
    expect(result.current.buffering).toBe(false);
    expect(speech.audio().src).toBe("blob:Two.");
  });

  it("resumes for a sentence that arrives after playback ran dry", async () => {
    const { speech, result } = startPlayback(["One."]);
    await respond(speech, "One.");
    await finish(speech);

    expect(result.current.speaking).toBe(false);
    expect(result.current.buffering).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();

    act(() => result.current.enqueue("Two."));
    expect(result.current.speaking).toBe(true);
    await respond(speech, "Two.");

    expect(speech.audio().src).toBe("blob:Two.");
    expect(result.current.activeIndex).toBe(1);
  });

  it("replays from the start without requesting the clips again", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    await respond(speech, "Two.");
    await finish(speech);

    act(() => result.current.playFrom(0));
    await settle();

    expect(speech.audio().src).toBe("blob:One.");
    expect(speech.fetch).toHaveBeenCalledTimes(2);
  });

  it("drops requests outside the window when jumping ahead", async () => {
    const { speech, result } = startPlayback([
      "One.",
      "Two.",
      "Three.",
      "Four.",
      "Five.",
      "Six.",
    ]);

    act(() => result.current.playFrom(4));

    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(speech.requests[1].signal.aborted).toBe(true);
    expect(speech.requested().slice(2)).toEqual(["Five.", "Six."]);
  });

  it("reports a pause, not an error, when the browser blocks autoplay", async () => {
    const { speech, result } = startPlayback(["One."]);
    FakeAudio.rejectNextPlay = "NotAllowedError";

    await respond(speech, "One.");

    expect(result.current.paused).toBe(true);
    expect(result.current.error).toBe(false);
  });

  it("stops at a sentence that could not be synthesized and retries it when played again", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);

    await fail(speech, "One.");

    expect(result.current.error).toBe(true);
    expect(result.current.paused).toBe(true);
    expect(result.current.buffering).toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);

    act(() => result.current.playFrom(0));
    expect(result.current.error).toBe(false);
    expect(speech.requested().filter((text) => text === "One.")).toHaveLength(
      2,
    );

    await respond(speech, "One.");
    expect(speech.audio().src).toBe("blob:One.");
    expect(result.current.activeIndex).toBe(0);
  });

  it("retries every failed clip when played again", async () => {
    // Two sentences keep both requests in flight together, so the pair fails
    // before a third sentence can take a slot.
    const { speech, result } = startPlayback(["One.", "Two."]);

    await fail(speech, "One.");
    await fail(speech, "Two.");
    expect(result.current.error).toBe(true);

    act(() => result.current.playFrom(0));

    const requested = speech.requested();
    expect(requested.filter((text) => text === "One.")).toHaveLength(2);
    expect(requested.filter((text) => text === "Two.")).toHaveLength(2);
    expect(speech.requests.filter((request) => !request.settled)).toHaveLength(
      2,
    );
  });

  it("aborts requests, stops audio and revokes clips on unmount", async () => {
    const { speech, unmount } = startPlayback(["One.", "Two.", "Three."]);
    await respond(speech, "One.");

    unmount();

    expect(speech.requests[1].signal.aborted).toBe(true);
    expect(speech.audio().pause).toHaveBeenCalled();
    expect(speech.revokeObjectURL).toHaveBeenCalledWith("blob:One.");
  });

  it("does not create an object URL for a dropped request", async () => {
    const { speech, result } = startPlayback(
      ["One.", "Two.", "Three.", "Four."],
      { ignoreAbort: true },
    );
    const stale = speech.requests[0];

    act(() => result.current.playFrom(3));
    expect(stale.signal.aborted).toBe(true);
    // The response was already in hand when the request was dropped.
    stale.respond();
    await settle();

    expect(speech.createObjectURL).not.toHaveBeenCalled();
  });

  it("stops at a clip the browser cannot decode", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);
    await respond(speech, "One.");

    act(() => speech.audio().breakClip());

    expect(result.current.error).toBe(true);
    expect(result.current.paused).toBe(true);
  });

  it("requests a retried sentence ahead of the look-ahead window", async () => {
    const { speech, result } = startPlayback(["One.", "Two.", "Three."]);

    await fail(speech, "One.");
    // "Two." and "Three." are now both loading.
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    act(() => result.current.playFrom(0));

    expect(speech.requested()).toEqual(["One.", "Two.", "Three.", "One."]);
    expect(speech.requests[2].signal.aborted).toBe(true);
    const live = speech.requests.filter(
      (request) => !request.signal.aborted && !request.settled,
    );
    expect(live.map((request) => request.text)).toEqual(["Two.", "One."]);
  });

  it("ignores media events from a clip it has moved away from", async () => {
    const { speech, result } = startPlayback([
      "One.",
      "Two.",
      "Three.",
      "Four.",
    ]);
    await respond(speech, "One.");
    expect(result.current.activeIndex).toBe(0);

    act(() => result.current.playFrom(2));
    await finish(speech);

    expect(result.current.activeIndex).toBeUndefined();
    expect(result.current.buffering).toBe(true);

    await respond(speech, "Three.");
    expect(speech.audio().src).toBe("blob:Three.");
    expect(result.current.activeIndex).toBe(2);
  });
});

describe("ServerSpeechQueue", () => {
  it("plays after dispose and a replay, as Strict Mode and the player do", async () => {
    const speech = installServerSpeech();
    const queue = new ServerSpeechQueue(42);

    queue.enqueue("One.");
    queue.enqueue("Two.");
    queue.playFrom(0);
    queue.dispose();
    queue.playFrom(0);

    expect(speech.requested()).toEqual(["One.", "Two.", "One.", "Two."]);

    await respond(speech, "One.");

    expect(speech.audio().src).toBe("blob:One.");
    expect(queue.getSnapshot().activeIndex).toBe(0);
  });
});
