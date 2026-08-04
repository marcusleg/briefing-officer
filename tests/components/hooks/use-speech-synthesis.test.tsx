import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeUtterance,
  installSpeechEngine,
} from "../../helpers/speech-synthesis";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSpeechSynthesis", () => {
  it("is unsupported when the browser has no speech engine", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.supported).toBe(false);
  });

  it("becomes supported once voices have loaded", () => {
    const voices: unknown[] = [];
    const speechSynthesis = installSpeechEngine(voices);

    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.supported).toBe(false);

    // Chrome fires voiceschanged once the engine has enumerated its voices.
    voices.push({ name: "Test Voice" });
    const [event, listener] = speechSynthesis.addEventListener.mock.calls[0];
    expect(event).toBe("voiceschanged");
    act(() => listener());

    expect(result.current.supported).toBe(true);
  });

  it("speaks the given text and reports that it is speaking", () => {
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));

    expect(speechSynthesis.speak).toHaveBeenCalledOnce();
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    expect(utterance.text).toBe("Hello world.");
    expect(result.current.speaking).toBe(true);
  });

  it("stops reporting speaking once the utterance ends", () => {
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    act(() => utterance.onend!());

    expect(result.current.speaking).toBe(false);
  });

  it("pings pause/resume so Chrome does not cut off long text", () => {
    vi.useFakeTimers();
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("A lead long enough to be truncated."));
    act(() => void vi.advanceTimersByTime(10_000));

    expect(speechSynthesis.pause).toHaveBeenCalledOnce();
    expect(speechSynthesis.resume).toHaveBeenCalledOnce();
  });

  it("stops the keepalive ping once the utterance ends", () => {
    vi.useFakeTimers();
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    act(() => utterance.onend!());
    act(() => void vi.advanceTimersByTime(30_000));

    expect(speechSynthesis.pause).not.toHaveBeenCalled();
  });

  it("cancels playback when the component unmounts", () => {
    const speechSynthesis = installSpeechEngine();
    const { result, unmount } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));
    speechSynthesis.cancel.mockClear();
    unmount();

    expect(speechSynthesis.cancel).toHaveBeenCalledOnce();
  });

  it("tears down the keepalive interval on unmount", () => {
    vi.useFakeTimers();
    const speechSynthesis = installSpeechEngine();
    const { result, unmount } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("A lead long enough to be truncated."));
    unmount();
    speechSynthesis.pause.mockClear();
    act(() => void vi.advanceTimersByTime(30_000));

    expect(speechSynthesis.pause).not.toHaveBeenCalled();
  });

  it("does not cancel another instance's active playback on unmount", () => {
    const speechSynthesis = installSpeechEngine();
    const cardA = renderHook(() => useSpeechSynthesis());
    const cardB = renderHook(() => useSpeechSynthesis());

    // Card A starts speaking; card B never does.
    act(() => cardA.result.current.speak("Card A's headline and lead."));
    speechSynthesis.cancel.mockClear();

    // Card B unmounts (e.g. dismissed from the feed) without ever speaking.
    cardB.unmount();

    expect(speechSynthesis.cancel).not.toHaveBeenCalled();
    expect(cardA.result.current.speaking).toBe(true);
  });

  it("does not leak keepalive intervals when speak is called twice in succession", () => {
    vi.useFakeTimers();
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    // First speak call sets up interval1
    act(() => result.current.speak("First utterance."));
    const firstUtterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;

    // Second speak call should clear interval1 via stopKeepAlive() at the
    // start, then set up interval2
    act(() => result.current.speak("Second utterance."));

    // Clear mocks to track only interval2's behavior
    speechSynthesis.pause.mockClear();
    speechSynthesis.resume.mockClear();

    // Advance timers to trigger interval2 (the second utterance's keepalive)
    act(() => void vi.advanceTimersByTime(10_000));

    // Verify interval2 was triggered
    expect(speechSynthesis.pause).toHaveBeenCalledOnce();
    expect(speechSynthesis.resume).toHaveBeenCalledOnce();

    // Now fire the first utterance's onend handler (simulating async completion)
    // This should NOT clear interval2 because handleDone1 checks if the
    // interval it's trying to clear is the current one
    speechSynthesis.pause.mockClear();
    speechSynthesis.resume.mockClear();
    act(() => firstUtterance.onend!());

    // Advance timers to verify interval2 is still running
    act(() => void vi.advanceTimersByTime(10_000));

    // The second utterance's keepalive should still be running
    expect(speechSynthesis.pause).toHaveBeenCalledOnce();
    expect(speechSynthesis.resume).toHaveBeenCalledOnce();
    expect(result.current.speaking).toBe(true);
  });
});
