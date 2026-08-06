import { DEFAULT_LANGUAGE } from "@/lib/language";
import * as React from "react";

interface SpeechSynthesisControls {
  activeIndex: number | undefined;
  cancel: () => void;
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

// Centralizes the "does this environment even have the API" check so
// playFrom(), cancel(), pause(), resume(), and speakSentence() do not each
// repeat it — and, more importantly, so none of them can forget it. The
// support effect below only gates the `supported` flag; it does not stop
// these functions from being called (the player's mount effect calls
// playFrom(0) unconditionally, before `supported` can gate anything).
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
 * Only one audio surface is mounted at a time, so this needs none of the
 * cross-component arbitration a per-card version would.
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
  const playing = React.useRef(false);
  const rateValue = React.useRef(1);
  const activeIndexValue = React.useRef<number | undefined>(undefined);

  // Identifies this instance for the engine-ownership check below. A ref so
  // it survives Strict Mode's remount, which reuses the same instance.
  const ownerToken = React.useRef<symbol>(undefined as unknown as symbol);
  ownerToken.current ??= Symbol("speech-engine-owner");

  // Resolved once here so every utterance and the voice lookup agree on it.
  const spokenLanguage = language ?? DEFAULT_LANGUAGE;

  // Read at speak() time rather than through state, because sentences are
  // handed to the engine as they stream in, outside a render.
  const voice = React.useRef<SpeechSynthesisVoice | undefined>(undefined);

  // Incremented whenever the engine queue is discarded. cancel() makes the
  // engine fire onend for every pending utterance, so handlers compare against
  // this to tell "my queue finished" from "my queue was thrown away".
  const generation = React.useRef(0);

  // True when playback stopped because handleDone reached the last retained
  // sentence, as opposed to a deliberate playFrom()/cancel(). Lets enqueue()
  // tell "the stream stalled, resume for the new arrival" apart from "the
  // listener stopped playback on purpose".
  const endedAtTail = React.useRef(false);

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
        activeIndexValue.current = index;
        setActiveIndex(index);
      };

      const handleDone = () => {
        if (generation.current !== forGeneration) return;

        // More sentences may have arrived while this one was speaking, and the
        // engine is already playing them. Only the true tail ends playback.
        if (index !== sentences.current.length - 1) return;

        playing.current = false;
        endedAtTail.current = true;
        activeIndexValue.current = undefined;
        setSpeaking(false);
        setPaused(false);
        setActiveIndex(undefined);
      };

      utterance.onend = handleDone;
      utterance.onerror = handleDone;

      engine.speak(utterance);
    },
    [spokenLanguage],
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

      playing.current = true;
      endedAtTail.current = false;
      // Known immediately, unlike the state below: setRate() reads this ref
      // to decide where to re-speak from, and it may be called again before
      // the engine ever fires onstart for this position. The React state
      // (activeIndex, cleared just below) is the confirmed, visible
      // highlight — it stays undefined until the engine reports a sentence
      // has actually started.
      activeIndexValue.current = index;
      setSpeaking(true);
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
    [speakSentence],
  );

  const enqueue = React.useCallback(
    (sentence: string) => {
      const index = sentences.current.length;
      sentences.current = [...sentences.current, sentence];

      // While playing, hand the sentence straight to the engine — it appends to
      // its own FIFO queue, so playback continues rather than restarting.
      if (playing.current) {
        speakSentence(index, generation.current);
        return;
      }

      // Playback previously stopped only because it ran out of retained
      // sentences, not because the listener stopped it deliberately. The
      // stream has caught up, so resume for the sentence that just arrived.
      if (endedAtTail.current) {
        endedAtTail.current = false;
        playing.current = true;
        setSpeaking(true);
        speakSentence(index, generation.current);
      }
    },
    [speakSentence],
  );

  const cancel = React.useCallback(() => {
    const engine = speechEngine();
    if (!engine) return;

    generation.current += 1;
    playing.current = false;
    endedAtTail.current = false;
    activeIndexValue.current = undefined;
    engine.cancel();
    // See the comment in playFrom(): cancel() alone leaves the engine's
    // paused flag latched, which would silently swallow the next speak().
    engine.resume();
    setSpeaking(false);
    setPaused(false);
    setActiveIndex(undefined);
  }, []);

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
      if (playing.current) {
        playFrom(activeIndexValue.current ?? 0);
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
    engineOwner = ownerToken.current;

    return () => {
      if (engineOwner !== ownerToken.current) return;
      engineOwner = undefined;
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    activeIndex,
    cancel,
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
