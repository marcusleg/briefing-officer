import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

afterEach(() => vi.unstubAllGlobals());

/**
 * The prologue nearly every test shares: install the fake engine, mount the
 * hook, retain some sentences and start speaking them from the top.
 */
const startPlayback = (
  sentences: string[],
  options: { language?: string | null; voices?: unknown[] } = {},
) => {
  const engine = installSpeechEngine(options.voices);
  const rendered = renderHook(() =>
    useSpeechSynthesis(options.language ?? "en"),
  );

  act(() => {
    for (const sentence of sentences) {
      rendered.result.current.enqueue(sentence);
    }
    rendered.result.current.playFrom(0);
  });

  return { engine, ...rendered };
};

const spokenText = (engine: ReturnType<typeof installSpeechEngine>) =>
  engine.spoken().map((utterance) => utterance.text);

describe("useSpeechSynthesis", () => {
  it("is unsupported when the browser has no speech engine", () => {
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    expect(result.current.supported).toBe(false);
  });

  it("becomes supported once voices have loaded", () => {
    const voices: unknown[] = [];
    const engine = installSpeechEngine(voices);

    const { result } = renderHook(() => useSpeechSynthesis("en"));
    expect(result.current.supported).toBe(false);

    // Chrome fires voiceschanged once the engine has enumerated its voices.
    voices.push({ name: "Test Voice", lang: "en-US" });
    const [event, listener] = engine.addEventListener.mock.calls[0];
    expect(event).toBe("voiceschanged");
    act(() => listener());

    expect(result.current.supported).toBe(true);
  });

  it("does not speak sentences enqueued before playback starts", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => result.current.enqueue("One."));

    expect(engine.speak).not.toHaveBeenCalled();
  });

  it("speaks the retained sentences in order once playback starts", () => {
    const { engine, result } = startPlayback(["One.", "Two."]);

    expect(spokenText(engine)).toEqual(["One.", "Two."]);
    expect(result.current.speaking).toBe(true);
  });

  it("appends to the live queue without restarting playback", () => {
    const { engine, result } = startPlayback(["One."]);

    act(() => result.current.enqueue("Two."));

    // The engine queues utterances FIFO, so appending is enough — a restart
    // would replay "One." from the beginning.
    expect(spokenText(engine)).toEqual(["One.", "Two."]);
    expect(engine.cancel).toHaveBeenCalledOnce();
  });

  it("tracks which sentence is speaking", () => {
    const { engine, result } = startPlayback(["One.", "Two."]);
    expect(result.current.activeIndex).toBeUndefined();

    act(() => engine.spoken()[0].onstart!());
    expect(result.current.activeIndex).toBe(0);

    act(() => engine.spoken()[1].onstart!());
    expect(result.current.activeIndex).toBe(1);
  });

  it("stops speaking once the final sentence ends", () => {
    const { engine, result } = startPlayback(["One.", "Two."]);

    act(() => engine.spoken()[0].onend!());
    expect(result.current.speaking).toBe(true);

    act(() => engine.spoken()[1].onend!());
    expect(result.current.speaking).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();
  });

  it("ignores end events from a queue that was thrown away", () => {
    const { engine, result } = startPlayback(["One."]);
    const discarded = engine.spoken()[0];

    act(() => result.current.playFrom(0));
    // cancel() makes the real engine fire onend for every pending utterance.
    act(() => discarded.onend!());

    expect(result.current.speaking).toBe(true);
  });

  it("pauses and resumes without ending playback", () => {
    const { engine, result } = startPlayback(["One."]);

    act(() => result.current.pause());
    expect(engine.pause).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(true);
    expect(result.current.speaking).toBe(true);

    engine.resume.mockClear();
    act(() => result.current.resume());
    expect(engine.resume).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(false);
  });

  it("applies the rate to newly spoken utterances", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => result.current.setRate(1.5));
    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    expect(result.current.rate).toBe(1.5);
    expect(engine.spoken()[0].rate).toBe(1.5);
  });

  it("re-speaks from the active sentence when the rate changes mid-playback", () => {
    const { engine, result } = startPlayback(["One.", "Two."]);
    act(() => engine.spoken()[1].onstart!());

    act(() => result.current.setRate(1.5));

    // rate is read at speak() time, so queued utterances keep the old value.
    // Only the sentence being spoken and those after it are re-queued.
    expect(spokenText(engine)).toEqual(["Two."]);
    expect(engine.spoken()[0].rate).toBe(1.5);
  });

  it("only stores the rate when nothing is playing", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => result.current.enqueue("One."));
    act(() => result.current.setRate(1.5));

    expect(engine.speak).not.toHaveBeenCalled();
    expect(result.current.rate).toBe(1.5);
  });

  it("un-pauses the engine when re-speaking, since cancel does not clear it", () => {
    const { engine, result } = startPlayback(["One."]);
    act(() => result.current.pause());

    engine.resume.mockClear();
    act(() => result.current.setRate(1.5));

    // speechSynthesis.pause() latches a flag that cancel() leaves set, so
    // without an explicit resume the re-spoken queue would be silent.
    expect(engine.resume).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(false);
  });

  it("resumes speaking when a sentence arrives after the stream stalled", () => {
    const { engine, result } = startPlayback(["One."]);
    // The stream fell behind the voice: the only known sentence finishes.
    act(() => engine.spoken()[0].onend!());
    expect(result.current.speaking).toBe(false);

    act(() => result.current.enqueue("Two."));

    expect(engine.spoken().at(-1)!.text).toBe("Two.");
    expect(result.current.speaking).toBe(true);
    // Appended rather than restarted: the engine was never cancelled.
    expect(engine.cancel).toHaveBeenCalledOnce();
  });

  it("keeps its place when the rate changes twice before speech starts", () => {
    const { engine, result } = startPlayback(["One.", "Two.", "Three."]);
    act(() => engine.spoken()[2].onstart!());

    act(() => result.current.setRate(1.2));
    act(() => result.current.setRate(1.4));

    // Without a remembered position the second change would fall back to 0 and
    // restart the briefing from the top, re-speaking "One." and "Two." too.
    expect(spokenText(engine)).toEqual(["Three."]);
  });

  it.each([
    {
      what: "matches a voice by the article's language",
      language: "de",
      voices: [
        { name: "Test Voice", lang: "en-US" },
        { name: "Anna", lang: "de-DE" },
      ],
      matched: "Anna",
      spokenLanguage: "de",
    },
    {
      // Chrome reports "de-DE"; some Linux engines report "de_DE".
      what: "matches a voice that reports an underscore separator",
      language: "de",
      voices: [{ name: "Anna", lang: "de_DE" }],
      matched: "Anna",
      spokenLanguage: "de",
    },
    {
      // The engine gets its own fallback rather than an undefined voice, and
      // `lang` still tells it what it is reading.
      what: "leaves the voice unset when none matches, but still speaks",
      language: "de",
      voices: [{ name: "Test Voice", lang: "en-US" }],
      matched: undefined,
      spokenLanguage: "de",
    },
    {
      what: "treats a missing language as English",
      language: null,
      voices: [{ name: "Test Voice", lang: "en-US" }],
      matched: "Test Voice",
      spokenLanguage: "en",
    },
  ])("$what", ({ language, voices, matched, spokenLanguage }) => {
    const { engine, result } = startPlayback(["Guten Tag."], {
      language,
      voices,
    });

    expect(result.current.supported).toBe(true);
    expect(result.current.voiceAvailable).toBe(matched !== undefined);
    expect(engine.spoken()[0].voice).toBe(
      voices.find((voice) => voice.name === matched),
    );
    expect(engine.spoken()[0].lang).toBe(spokenLanguage);
  });

  it("finds a matching voice that loads late", () => {
    const voices: unknown[] = [];
    const engine = installSpeechEngine(voices);

    const { result } = renderHook(() => useSpeechSynthesis("de"));
    expect(result.current.voiceAvailable).toBe(false);

    voices.push({ name: "Anna", lang: "de-DE" });
    const [, listener] = engine.addEventListener.mock.calls[0];
    act(() => listener());

    expect(result.current.voiceAvailable).toBe(true);
  });

  it("cancels playback when the owning instance unmounts", () => {
    const engine = installSpeechEngine();
    const only = renderHook(() => useSpeechSynthesis("en"));

    engine.cancel.mockClear();
    only.unmount();

    expect(engine.cancel).toHaveBeenCalled();
  });

  it("does not cancel playback once a newer instance has taken over", () => {
    // A router navigation commits inside a transition, so the outgoing page's
    // cleanup can run after the incoming page has mounted and queued its
    // opening line. Cancelling then would silence the new page.
    const engine = installSpeechEngine();
    const outgoing = renderHook(() => useSpeechSynthesis("en"));
    const incoming = renderHook(() => useSpeechSynthesis("en"));

    act(() => incoming.result.current.enqueue("Fresh headline."));
    act(() => incoming.result.current.playFrom(0));
    engine.cancel.mockClear();

    outgoing.unmount();

    expect(engine.cancel).not.toHaveBeenCalled();
    expect(engine.spoken().at(-1)!.text).toBe("Fresh headline.");
  });
});
