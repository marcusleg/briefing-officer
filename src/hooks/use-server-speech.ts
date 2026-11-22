import type { SpeechControls } from "@/hooks/speech-controls";
import {
  INITIAL_SERVER_SPEECH_SNAPSHOT,
  ServerSpeechQueue,
  type SpeechQueue,
} from "@/lib/server-speech-queue";
import { findStreamFormat, StreamSpeechQueue } from "@/lib/stream-speech-queue";
import * as React from "react";

const getServerSnapshot = () => INITIAL_SERVER_SPEECH_SNAPSHOT;

/**
 * Reads text through the TTS service behind /api/speech: text about an
 * article, or, without an article id, English text such as a chat answer.
 *
 * Where Media Source Extensions can play MP3, the clips form one continuous
 * stream, which keeps playing in the background. Elsewhere they play one after
 * another.
 *
 * The queue is bound to the article it was created for. Each instance owns its
 * own <audio> element, so the overlap a client-side navigation creates needs no
 * coordination between pages.
 */
export function useServerSpeech(articleId?: number): SpeechControls {
  const [queue] = React.useState((): SpeechQueue => {
    const format = findStreamFormat();
    return format
      ? new StreamSpeechQueue(articleId, format)
      : new ServerSpeechQueue(articleId);
  });
  const state = React.useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    getServerSnapshot,
  );

  // Strict Mode runs this cleanup between its two mount passes. The queue
  // keeps its sentences through dispose(), so the reader's replay works.
  React.useEffect(() => () => queue.dispose(), [queue]);

  return {
    ...state,
    enqueue: queue.enqueue,
    finish: queue.finish,
    pause: queue.pause,
    playFrom: queue.playFrom,
    resume: queue.resume,
    setRate: queue.setRate,
    supported: true,
    voiceAvailable: true,
  };
}
