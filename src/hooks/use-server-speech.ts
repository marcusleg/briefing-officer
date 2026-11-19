import type { SpeechControls } from "@/hooks/speech-controls";
import {
  INITIAL_SERVER_SPEECH_SNAPSHOT,
  ServerSpeechQueue,
} from "@/lib/server-speech-queue";
import * as React from "react";

const getServerSnapshot = () => INITIAL_SERVER_SPEECH_SNAPSHOT;

/**
 * Reads text through the TTS service behind /api/speech: an article's
 * briefing, or, without an article id, English text such as a chat answer.
 *
 * The queue is bound to the article it was created for. Each instance owns its
 * own <audio> element, so the overlap a client-side navigation creates needs no
 * coordination between pages.
 */
export function useServerSpeech(articleId?: number): SpeechControls {
  const [queue] = React.useState(() => new ServerSpeechQueue(articleId));
  const state = React.useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    getServerSnapshot,
  );

  // Strict Mode runs this cleanup between its two mount passes. The queue
  // keeps its sentences through dispose(), so the player's replay works.
  React.useEffect(() => () => queue.dispose(), [queue]);

  return {
    ...state,
    enqueue: queue.enqueue,
    pause: queue.pause,
    playFrom: queue.playFrom,
    resume: queue.resume,
    setRate: queue.setRate,
    supported: true,
    voiceAvailable: true,
  };
}
