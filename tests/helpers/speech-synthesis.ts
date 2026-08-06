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
 * `spoken()` returns the utterances handed to `speak()` in order, which is the
 * queue the real engine would play back to back.
 */
export const installSpeechEngine = (
  voices: unknown[] = [{ name: "Test Voice", lang: "en-US" }],
) => {
  const speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
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
    spoken: () =>
      speechSynthesis.speak.mock.calls.map(
        (call) => call[0] as unknown as FakeUtterance,
      ),
  };
};
