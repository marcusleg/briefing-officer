import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

afterEach(() => vi.unstubAllGlobals());

describe("useSpeechSynthesis", () => {
  it("is unsupported when the browser has no speech engine", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.supported).toBe(false);
  });

  it("becomes supported once voices have loaded", () => {
    const voices: unknown[] = [];
    const engine = installSpeechEngine(voices);

    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.supported).toBe(false);

    // Chrome fires voiceschanged once the engine has enumerated its voices.
    voices.push({ name: "Test Voice" });
    const [event, listener] = engine.addEventListener.mock.calls[0];
    expect(event).toBe("voiceschanged");
    act(() => listener());

    expect(result.current.supported).toBe(true);
  });

  it("does not speak sentences enqueued before playback starts", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.enqueue("One."));

    expect(engine.speak).not.toHaveBeenCalled();
  });

  it("speaks the retained sentences in order once playback starts", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    act(() => result.current.pause());
    expect(engine.pause).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(true);
    expect(result.current.speaking).toBe(true);

    act(() => result.current.resume());
    expect(engine.resume).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(false);
  });

  it("cancels playback and clears the active sentence", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

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
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.enqueue("One."));
    act(() => result.current.setRate(1.5));

    expect(engine.speak).not.toHaveBeenCalled();
    expect(result.current.rate).toBe(1.5);
  });

  it("cancels playback when the component unmounts", () => {
    const engine = installSpeechEngine();
    const { result, unmount } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    unmount();

    // Only one audio surface is ever mounted, so this needs no ownership check.
    expect(engine.cancel).toHaveBeenCalledTimes(2);
  });
});
