import { DEFAULT_LANGUAGE } from "@/lib/language";
import * as React from "react";

interface SpeechSynthesisControls {
  activeIndex: number | undefined;
  enqueue: (sentence: string) => void;
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

// `speechSynthesis` is a single global shared by every instance of this hook,
// so exactly one of them may own it at a time. Module scope rather than a ref
// because the point is coordination *between* instances during the overlap a
// client-side navigation creates.
let engineOwner: symbol | undefined;

type Playback = "idle" | "playing" | "ranDry";

// Centralizes the "does this environment even have the API" check so no
// caller can forget it: the player's mount effect calls playFrom(0)
// unconditionally, before the `supported` flag can gate anything.
const speechEngine = () =>
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : undefined;

/**
 * Drives the Web Speech API as a queue of sentences.
 *
 * Utterances are handed to `speechSynthesis` one sentence at a time and the
 * engine plays them back to back, so a script can start speaking while the rest
 * of it is still being generated. Short utterances also stay well under the
 * roughly 15 second cut-off Chrome applies to a single long one.
 *
 * Only one audio surface is mounted at a time, but a client-side navigation
 * briefly overlaps two, so the module-level owner token above arbitrates.
 */
export function useSpeechSynthesis(
  language: string | null,
): SpeechSynthesisControls {
  const [supported, setSupported] = React.useState(false);
  const [voiceAvailable, setVoiceAvailable] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined,
  );
  const [rate, setRateState] = React.useState(1);

  // Every sentence handed to enqueue(), retained so playFrom() can re-speak
  // from an arbitrary point.
  const sentences = React.useRef<string[]>([]);
  const rateValue = React.useRef(1);
  const queuedFromIndex = React.useRef<number | undefined>(undefined);

  // "ranDry" means playback stopped because handleDone reached the last
  // retained sentence, as opposed to a deliberate playFrom(). Lets enqueue()
  // tell "the stream stalled, resume for the new arrival" apart from "playback
  // was never started".
  const playback = React.useRef<Playback>("idle");
  const setPlayback = React.useCallback((next: Playback) => {
    playback.current = next;
    setSpeaking(next === "playing");
  }, []);

  // Identifies this instance for the engine-ownership check below. Stable for
  // the lifetime of the instance, so it survives Strict Mode's remount.
  const [ownerToken] = React.useState(() => Symbol("speech-engine-owner"));

  // Resolved once here so every utterance and the voice lookup agree on it.
  const spokenLanguage = language ?? DEFAULT_LANGUAGE;

  // Read at speak() time rather than through state, because sentences are
  // handed to the engine as they stream in, outside a render.
  const voice = React.useRef<SpeechSynthesisVoice | undefined>(undefined);

  // Incremented whenever the engine queue is discarded. cancel() makes the
  // engine fire onend for every pending utterance, so handlers compare against
  // this to tell "my queue finished" from "my queue was thrown away".
  const generation = React.useRef(0);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    // getVoices() is populated asynchronously in Chrome, so an empty list only
    // means "no voices" after voiceschanged has fired. Linux without
    // speech-dispatcher installed never reports any.
    const syncVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSupported(voices.length > 0);

      // Engines disagree on the separator. Browsers report the BCP-47 form
      // ("de-DE"), while some Linux speech backends surface a POSIX locale
      // ("de_DE") instead.
      const match = voices.find(
        (candidate) =>
          candidate.lang?.toLowerCase().split(/[-_]/)[0] === spokenLanguage,
      );
      voice.current = match;
      setVoiceAvailable(match !== undefined);
    };

    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);

    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", syncVoices);
  }, [spokenLanguage]);

  const speakSentence = React.useCallback(
    (index: number, forGeneration: number) => {
      const engine = speechEngine();
      if (!engine) return;

      const utterance = new SpeechSynthesisUtterance(sentences.current[index]);
      utterance.rate = rateValue.current;
      utterance.lang = spokenLanguage;

      // Assigned only when a match exists: handing the engine an undefined
      // voice is not the same as leaving it to pick its own default.
      if (voice.current) {
        utterance.voice = voice.current;
      }

      utterance.onstart = () => {
        if (generation.current !== forGeneration) return;
        queuedFromIndex.current = index;
        setActiveIndex(index);
      };

      const handleDone = () => {
        if (generation.current !== forGeneration) return;

        // More sentences may have arrived while this one was speaking, and the
        // engine is already playing them. Only the true tail ends playback.
        if (index !== sentences.current.length - 1) return;

        setPlayback("ranDry");
        queuedFromIndex.current = undefined;
        setPaused(false);
        setActiveIndex(undefined);
      };

      utterance.onend = handleDone;
      utterance.onerror = handleDone;

      engine.speak(utterance);
    },
    [spokenLanguage, setPlayback],
  );

  const playFrom = React.useCallback(
    (index: number) => {
      const engine = speechEngine();
      if (!engine) return;

      generation.current += 1;
      const forGeneration = generation.current;
      engine.cancel();
      // cancel() empties the queue but does not clear the paused flag it
      // latches on the engine, so a speak() right after would sit silent
      // until something called resume(). This is a deliberate transition,
      // so it never leaves playback stalled at the tail.
      engine.resume();

      setPlayback("playing");
      // The queued-from position, known synchronously. `activeIndex` below is
      // the engine-confirmed highlight and stays undefined until onstart fires.
      queuedFromIndex.current = index;
      setPaused(false);
      setActiveIndex(undefined);

      for (
        let position = index;
        position < sentences.current.length;
        position++
      ) {
        speakSentence(position, forGeneration);
      }
    },
    [speakSentence, setPlayback],
  );

  const enqueue = React.useCallback(
    (sentence: string) => {
      const index = sentences.current.length;
      sentences.current = [...sentences.current, sentence];

      // While playing, hand the sentence straight to the engine — it appends to
      // its own FIFO queue, so playback continues rather than restarting.
      if (playback.current === "playing") {
        speakSentence(index, generation.current);
        return;
      }

      // Playback previously stopped only because it ran out of retained
      // sentences. The stream has caught up, so resume for the sentence that
      // just arrived.
      if (playback.current === "ranDry") {
        setPlayback("playing");
        speakSentence(index, generation.current);
      }
    },
    [speakSentence, setPlayback],
  );

  const pause = React.useCallback(() => {
    const engine = speechEngine();
    if (!engine) return;

    engine.pause();
    setPaused(true);
  }, []);

  const resume = React.useCallback(() => {
    const engine = speechEngine();
    if (!engine) return;

    engine.resume();
    setPaused(false);
  }, []);

  const setRate = React.useCallback(
    (next: number) => {
      rateValue.current = next;
      setRateState(next);

      // rate is read at speak() time, so utterances already queued keep the old
      // value. Re-speak from the current sentence to apply it immediately.
      if (playback.current === "playing") {
        playFrom(queuedFromIndex.current ?? 0);
      }
    },
    [playFrom],
  );

  // Stop playback when the page goes away — but only while this instance is
  // still the engine's owner.
  //
  // Router navigations commit inside a transition, so the outgoing page's
  // cleanup can run *after* the incoming page has mounted and queued its
  // first utterance. Cancelling unconditionally then silences the new page's
  // opening line while everything it streams later survives, because those
  // arrive well after the stale cleanup. Claiming ownership on mount and
  // checking it on cleanup fixes the ordering rather than racing it.
  React.useEffect(() => {
    engineOwner = ownerToken;

    return () => {
      if (engineOwner !== ownerToken) return;
      engineOwner = undefined;
      window.speechSynthesis?.cancel();
    };
  }, [ownerToken]);

  return {
    activeIndex,
    enqueue,
    pause,
    paused,
    playFrom,
    rate,
    resume,
    setRate,
    speaking,
    supported,
    voiceAvailable,
  };
}
