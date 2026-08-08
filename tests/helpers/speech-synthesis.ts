import { vi } from "vitest";

/**
 * jsdom implements neither `speechSynthesis` nor `SpeechSynthesisUtterance`,
 * so tests that exercise the Web Speech API install these fakes instead.
 */
export class FakeUtterance {
  text: string;
  rate = 1;
  lang = "";
  voice: unknown = undefined;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

/**
 * Installs a fake speech engine on the global object and returns it so tests
 * can assert against its calls. Pass an empty array to simulate a browser with
 * no voices installed. Call `vi.unstubAllGlobals()` afterwards.
 *
 * `spoken()` returns the live queue: the utterances handed to `speak()` and not
 * since discarded by `cancel()`, which is what the real engine would play back
 * to back. `allSpoken()` returns every utterance ever queued, cancelled ones
 * included, for the rare test that needs to look behind a cancel.
 */
export const installSpeechEngine = (
  voices: unknown[] = [{ name: "Test Voice", lang: "en-US" }],
) => {
  let queue: FakeUtterance[] = [];
  const everQueued: FakeUtterance[] = [];

  const speechSynthesis = {
    speak: vi.fn((utterance: FakeUtterance) => {
      queue.push(utterance);
      everQueued.push(utterance);
    }),
    cancel: vi.fn(() => {
      queue = [];
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal("speechSynthesis", speechSynthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

  return {
    ...speechSynthesis,
    spoken: () => queue,
    allSpoken: () => everQueued,
  };
};
