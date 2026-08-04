import { vi } from "vitest";

/**
 * jsdom implements neither `speechSynthesis` nor `SpeechSynthesisUtterance`,
 * so tests that exercise the Web Speech API install these fakes instead.
 */
export class FakeUtterance {
  text: string;
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
 */
export const installSpeechEngine = (
  voices: unknown[] = [{ name: "Test Voice" }],
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

  return speechSynthesis;
};
