import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

afterEach(() => vi.unstubAllGlobals());

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
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });

    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "One.",
      "Two.",
    ]);
    expect(result.current.speaking).toBe(true);
  });

  it("appends to the live queue without restarting playback", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    act(() => result.current.enqueue("Two."));

    // The engine queues utterances FIFO, so appending is enough — a restart
    // would replay "One." from the beginning.
    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "One.",
      "Two.",
    ]);
    expect(engine.cancel).toHaveBeenCalledOnce();
  });

  it("tracks which sentence is speaking", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });
    expect(result.current.activeIndex).toBeUndefined();

    act(() => engine.spoken()[0].onstart!());
    expect(result.current.activeIndex).toBe(0);

    act(() => engine.spoken()[1].onstart!());
    expect(result.current.activeIndex).toBe(1);
  });

  it("stops speaking once the final sentence ends", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });

    act(() => engine.spoken()[0].onend!());
    expect(result.current.speaking).toBe(true);

    act(() => engine.spoken()[1].onend!());
    expect(result.current.speaking).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();
  });

  it("ignores end events from a queue that was thrown away", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    const discarded = engine.spoken()[0];

    act(() => result.current.playFrom(0));
    // cancel() makes the real engine fire onend for every pending utterance.
    act(() => discarded.onend!());

    expect(result.current.speaking).toBe(true);
  });

  it("pauses and resumes without ending playback", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    act(() => result.current.pause());
    expect(engine.pause).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(true);
    expect(result.current.speaking).toBe(true);

    act(() => result.current.resume());
    // playFrom() also calls resume() defensively (cancel() alone leaves the
    // engine's paused flag latched), so the explicit resume() here is the
    // second call, mirroring the cancel() count below.
    expect(engine.resume).toHaveBeenCalledTimes(2);
    expect(result.current.paused).toBe(false);
  });

  it("cancels playback and clears the active sentence", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    act(() => result.current.cancel());

    expect(result.current.speaking).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();
    expect(engine.cancel).toHaveBeenCalledTimes(2);
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
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });
    act(() => engine.spoken()[1].onstart!());

    act(() => result.current.setRate(1.5));

    // rate is read at speak() time, so queued utterances keep the old value.
    // Only the sentence being spoken and those after it are re-queued.
    const respoken = engine.spoken().slice(2);
    expect(respoken.map((utterance) => utterance.text)).toEqual(["Two."]);
    expect(respoken[0].rate).toBe(1.5);
  });

  it("only stores the rate when nothing is playing", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => result.current.enqueue("One."));
    act(() => result.current.setRate(1.5));

    expect(engine.speak).not.toHaveBeenCalled();
    expect(result.current.rate).toBe(1.5);
  });

  it("cancels playback when the component unmounts", () => {
    const engine = installSpeechEngine();
    const { result, unmount } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    unmount();

    // Only one audio surface is ever mounted, so this needs no ownership check.
    expect(engine.cancel).toHaveBeenCalledTimes(2);
  });

  it("un-pauses the engine when re-speaking, since cancel does not clear it", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    act(() => result.current.pause());
    act(() => result.current.setRate(1.5));

    // speechSynthesis.pause() latches a flag that cancel() leaves set, so
    // without an explicit resume the re-spoken queue would be silent.
    expect(engine.resume).toHaveBeenCalled();
    expect(result.current.paused).toBe(false);
  });

  it("resumes speaking when a sentence arrives after the stream stalled", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    // The stream fell behind the voice: the only known sentence finishes.
    act(() => engine.spoken()[0].onend!());
    expect(result.current.speaking).toBe(false);

    act(() => result.current.enqueue("Two."));

    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "One.",
      "Two.",
    ]);
    expect(result.current.speaking).toBe(true);
  });

  it("does not resume after the listener deliberately stopped playback", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    act(() => result.current.cancel());
    act(() => result.current.enqueue("Two."));

    // Only the pre-stop utterance was ever spoken.
    expect(engine.spoken()).toHaveLength(1);
    expect(result.current.speaking).toBe(false);
  });

  it("keeps its place when the rate changes twice before speech starts", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis("en"));

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.enqueue("Three.");
      result.current.playFrom(0);
    });
    act(() => engine.spoken()[2].onstart!());

    act(() => result.current.setRate(1.2));
    const spokenAfterFirstChange = engine.spoken().length;
    act(() => result.current.setRate(1.4));

    // Without a remembered position the second change would fall back to 0 and
    // restart the briefing from the top, re-speaking "One." and "Two." too.
    // Asserting only on the last call's text is not enough to catch that: a
    // full restart also ends up re-speaking "Three." last, since it is still
    // the final retained sentence either way.
    const respoken = engine.spoken().slice(spokenAfterFirstChange);
    expect(respoken.map((utterance) => utterance.text)).toEqual(["Three."]);
  });

  it("speaks with a voice matching the article's language", () => {
    const german = { name: "Anna", lang: "de-DE" };
    const engine = installSpeechEngine([
      { name: "Test Voice", lang: "en-US" },
      german,
    ]);

    const { result } = renderHook(() => useSpeechSynthesis("de"));
    act(() => result.current.enqueue("Guten Tag."));
    act(() => result.current.playFrom(0));

    expect(result.current.voiceAvailable).toBe(true);
    expect(engine.spoken()[0].voice).toBe(german);
    expect(engine.spoken()[0].lang).toBe("de");
  });

  it("matches voices that report an underscore separator", () => {
    // Chrome reports "de-DE"; some Linux engines report "de_DE".
    const german = { name: "Anna", lang: "de_DE" };
    const engine = installSpeechEngine([german]);

    const { result } = renderHook(() => useSpeechSynthesis("de"));
    act(() => result.current.enqueue("Guten Tag."));
    act(() => result.current.playFrom(0));

    expect(engine.spoken()[0].voice).toBe(german);
  });

  it("leaves the voice unset when none matches, but still speaks", () => {
    const engine = installSpeechEngine([{ name: "Test Voice", lang: "en-US" }]);

    const { result } = renderHook(() => useSpeechSynthesis("de"));
    act(() => result.current.enqueue("Guten Tag."));
    act(() => result.current.playFrom(0));

    expect(result.current.supported).toBe(true);
    expect(result.current.voiceAvailable).toBe(false);
    // The engine gets its own fallback rather than an undefined voice, and
    // `lang` still tells it what it is reading.
    expect(engine.spoken()[0].voice).toBeUndefined();
    expect(engine.spoken()[0].lang).toBe("de");
  });

  it("treats a missing language as English", () => {
    const english = { name: "Test Voice", lang: "en-US" };
    const engine = installSpeechEngine([english]);

    const { result } = renderHook(() => useSpeechSynthesis(null));
    act(() => result.current.enqueue("Hello."));
    act(() => result.current.playFrom(0));

    expect(result.current.voiceAvailable).toBe(true);
    expect(engine.spoken()[0].voice).toBe(english);
    expect(engine.spoken()[0].lang).toBe("en");
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
