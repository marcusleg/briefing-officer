"use client";

import { MessageAction } from "@/components/ai-elements/message";
import { Spinner } from "@/components/ui/spinner";
import type { SpeechControls } from "@/hooks/speech-controls";
import { useServerSpeech } from "@/hooks/use-server-speech";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { spokenSentences } from "@/lib/chat-speech-text";
import { SquareIcon, Volume2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

export type SpeechEngine = "browser" | "server";

const reportFailure = () =>
  toast.error("This answer could not be read aloud.", {
    id: "chat-read-aloud",
  });

// The browser engine can speak once it has voices. Chrome fills them in
// asynchronously, so the snapshot follows voiceschanged. The server snapshot
// applies to the server render and hydration only, which leaves the button out
// of both.
const subscribeToVoices = (onChange: () => void) => {
  if (!("speechSynthesis" in window)) return () => {};
  const { speechSynthesis } = window;
  speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => speechSynthesis.removeEventListener("voiceschanged", onChange);
};
const hasVoices = () =>
  "speechSynthesis" in window && window.speechSynthesis.getVoices().length > 0;
const onTheServer = () => false;
// The speech service never uses the browser's voices, so it does not watch them.
const ignoreVoices = () => () => {};

interface ChatSpeechProps {
  sentences: string[];
  onReadEnd: () => void;
}

/**
 * Reads the sentences from the first and shows the stop button meanwhile.
 * Mounted only while its answer is read; unmounting stops playback, because
 * both engines' hooks stop when they unmount.
 */
const ChatSpeech = ({
  speech,
  sentences,
  onReadEnd,
}: ChatSpeechProps & { speech: SpeechControls }) => {
  const {
    activeIndex,
    buffering,
    enqueue,
    error,
    finish,
    paused,
    playFrom,
    speaking,
  } = speech;
  // Strict Mode remounts with the hook's sentences retained, so the replay only
  // restarts playback instead of queuing every sentence a second time.
  const queued = useRef(false);
  // Playback is idle before it starts, which is not the same as having ended.
  const started = useRef(false);
  // Whether any of the answer has been heard yet.
  const heard = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    if (!queued.current) {
      queued.current = true;
      sentences.forEach(enqueue);
      finish();
    }
    playFrom(0);
  }, [sentences, enqueue, finish, playFrom]);

  useEffect(() => {
    if (ended.current) return;
    if (activeIndex !== undefined) heard.current = true;

    // This component never pauses playback. A pause before anything was heard
    // means the browser blocked it, such as autoplay without a user gesture.
    // Nothing would resume it, so reading ends like it does on an error. A
    // later pause came from outside the page, such as a headset button, which
    // can also resume it.
    if (error || (paused && !heard.current)) {
      ended.current = true;
      reportFailure();
      onReadEnd();
    } else if (paused) {
      return;
    } else if (speaking) {
      started.current = true;
    } else if (started.current) {
      ended.current = true;
      onReadEnd();
    }
  }, [activeIndex, error, paused, speaking, onReadEnd]);

  return (
    <MessageAction
      label="Stop reading"
      aria-label="Stop reading"
      onClick={onReadEnd}
    >
      {buffering ? <Spinner /> : <SquareIcon />}
    </MessageAction>
  );
};

// One component per engine, so only the selected engine's hook mounts. An idle
// browser hook would otherwise take speechSynthesis from another page.
const ServerChatSpeech = (props: ChatSpeechProps) => {
  const speech = useServerSpeech();
  return <ChatSpeech {...props} speech={speech} />;
};

const BrowserChatSpeech = (props: ChatSpeechProps) => {
  const speech = useSpeechSynthesis(null);
  return <ChatSpeech {...props} speech={speech} />;
};

interface ReadAloudProps {
  engine: SpeechEngine;
  /** The answer's Markdown. */
  text: string;
  /** Whether this answer is the one being read. */
  reading: boolean;
  onRead: () => void;
  onReadEnd: () => void;
}

/** The button that reads a chat answer aloud, at 1.0x and as English. */
export const ReadAloud = ({
  engine,
  text,
  reading,
  onRead,
  onReadEnd,
}: ReadAloudProps) => {
  const browserCanSpeak = useSyncExternalStore(
    engine === "browser" ? subscribeToVoices : ignoreVoices,
    engine === "browser" ? hasVoices : onTheServer,
    onTheServer,
  );
  const sentences = useMemo(() => spokenSentences(text), [text]);

  if (sentences.length === 0 || (engine === "browser" && !browserCanSpeak)) {
    return null;
  }

  if (!reading) {
    return (
      <MessageAction
        label="Read aloud"
        aria-label="Read aloud"
        onClick={onRead}
      >
        <Volume2Icon />
      </MessageAction>
    );
  }

  return engine === "server" ? (
    <ServerChatSpeech sentences={sentences} onReadEnd={onReadEnd} />
  ) : (
    <BrowserChatSpeech sentences={sentences} onReadEnd={onReadEnd} />
  );
};
