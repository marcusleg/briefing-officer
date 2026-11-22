/**
 * What a reader of text aloud needs from a speech engine. Implemented by
 * `useSpeechSynthesis` (the browser's voices) and `useServerSpeech` (a TTS
 * service behind /api/speech), so the reader is indifferent to which one speaks.
 */
export interface SpeechControls {
  /** Playback index of the sentence being heard, once audio has started. */
  activeIndex: number | undefined;
  /** Waiting for the current sentence's audio to arrive. */
  buffering: boolean;
  enqueue: (sentence: string) => void;
  /** Playback stopped because a sentence could not be synthesized. */
  error: boolean;
  /** No more sentences will be enqueued. */
  finish: () => void;
  pause: () => void;
  paused: boolean;
  playFrom: (index: number) => void;
  rate: number;
  resume: () => void;
  setRate: (rate: number) => void;
  speaking: boolean;
  supported: boolean;
  voiceAvailable: boolean;
}
