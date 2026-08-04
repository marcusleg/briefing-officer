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
}

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
export function useSpeechSynthesis(): SpeechSynthesisControls {
  const [supported, setSupported] = React.useState(false);
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
    const syncSupport = () =>
      setSupported(window.speechSynthesis.getVoices().length > 0);

    syncSupport();
    window.speechSynthesis.addEventListener("voiceschanged", syncSupport);

    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", syncSupport);
  }, []);

  const speakSentence = React.useCallback(
    (index: number, forGeneration: number) => {
      const utterance = new SpeechSynthesisUtterance(sentences.current[index]);
      utterance.rate = rateValue.current;

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
        activeIndexValue.current = undefined;
        setSpeaking(false);
        setPaused(false);
        setActiveIndex(undefined);
      };

      utterance.onend = handleDone;
      utterance.onerror = handleDone;

      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  const playFrom = React.useCallback(
    (index: number) => {
      generation.current += 1;
      const forGeneration = generation.current;
      window.speechSynthesis.cancel();

      playing.current = true;
      activeIndexValue.current = undefined;
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
      }
    },
    [speakSentence],
  );

  const cancel = React.useCallback(() => {
    generation.current += 1;
    playing.current = false;
    activeIndexValue.current = undefined;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
    setActiveIndex(undefined);
  }, []);

  const pause = React.useCallback(() => {
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = React.useCallback(() => {
    window.speechSynthesis.resume();
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

  // Stop playback when the page goes away. Only one audio surface is ever
  // mounted, so this cancels unconditionally.
  React.useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );

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
  };
}
