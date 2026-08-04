import * as React from "react";

// Chrome and Edge silently stop an utterance after roughly 15 seconds. Pinging
// pause()/resume() below that threshold keeps longer leads playing to the end.
const KEEPALIVE_INTERVAL_MS = 10_000;

interface SpeechSynthesisControls {
  cancel: () => void;
  speak: (text: string) => void;
  speaking: boolean;
  supported: boolean;
}

export function useSpeechSynthesis(): SpeechSynthesisControls {
  const [supported, setSupported] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const keepAlive = React.useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const currentUtterance = React.useRef<SpeechSynthesisUtterance | undefined>(
    undefined,
  );

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

  const stopKeepAlive = React.useCallback(() => {
    clearInterval(keepAlive.current);
    keepAlive.current = undefined;
  }, []);

  const cancel = React.useCallback(() => {
    stopKeepAlive();
    setSpeaking(false);
    currentUtterance.current = undefined;
    window.speechSynthesis.cancel();
  }, [stopKeepAlive]);

  const speak = React.useCallback(
    (text: string) => {
      // Clear any previous keepalive interval before starting new playback,
      // ensuring the old interval is not orphaned if speak() is called again
      // before the prior utterance ends.
      stopKeepAlive();

      // cancel() clears anything already queued, including an utterance started
      // by another card, so only one article is ever read at a time. The
      // displaced utterance fires onend, which resets that card's button.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance.current = utterance;
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
      const intervalId = setInterval(() => {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, KEEPALIVE_INTERVAL_MS);
      keepAlive.current = intervalId;

      const handleDone = () => {
        // Only update state if this is still the current utterance.
        // If speak() was called again, currentUtterance will point to the new one,
        // and we should not clear the interval or update the speaking state.
        if (currentUtterance.current === utterance) {
          currentUtterance.current = undefined;
          stopKeepAlive();
          setSpeaking(false);
        }
      };
      utterance.onend = handleDone;
      utterance.onerror = handleDone;
    },
    [stopKeepAlive],
  );

  // Stop playback when the card goes away (navigation, filtering, dismissal).
  // speechSynthesis is a global singleton shared by every mounted card, so
  // only cancel if this hook instance actually owns the utterance currently
  // playing — otherwise one card's unmount would silence another card's
  // in-progress playback.
  React.useEffect(
    () => () => {
      stopKeepAlive();
      if (currentUtterance.current) {
        currentUtterance.current = undefined;
        window.speechSynthesis?.cancel();
      }
    },
    [stopKeepAlive],
  );

  return { cancel, speak, speaking, supported };
}
