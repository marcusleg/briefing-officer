"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import ChatMessage, { messageText } from "@/components/chat/chat-message";
import { ReadAloud, type SpeechEngine } from "@/components/chat/read-aloud";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { compactEarlierTurns } from "@/lib/ai/chat/compactHistory";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { cn } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import {
  APICallError,
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * The whole conversation goes to the route on every question. Earlier article
 * texts would soon pass its size limit, so they are sent as references only,
 * the way the route compacts them for the model anyway.
 */
const createTransport = (articleId?: number) =>
  new DefaultChatTransport<ChatUIMessage>({
    api: "/api/chat",
    prepareSendMessagesRequest: ({
      id,
      messages,
      body,
      trigger,
      messageId,
    }) => ({
      body: {
        ...body,
        id,
        messages: compactEarlierTurns(messages),
        trigger,
        messageId,
        articleId,
      },
    }),
  });

export const transport = createTransport();

/** What the reader asks first when a chat opens from an article. */
const summaryRequest = (title: string) => `Summarize “${title}”.`;

const hasStatus = (error: Error, statusCode: number) =>
  APICallError.isInstance(error) && error.statusCode === statusCode;

/** The chat route answers 401 once the session is gone. */
const isSessionExpired = (error: Error) => hasStatus(error, 401);

/** Even compacted, a very long conversation can pass the route's size limit. */
const isTooLong = (error: Error) => hasStatus(error, 413);

/** The reason the model sees when the reader types instead of answering a card. */
export const DECLINED_BY_REPLY = "The reader replied instead of approving.";

/** The approval ids of the status-change cards still waiting in the last answer. */
const pendingApprovalIds = (messages: ChatUIMessage[]) => {
  const last = messages.at(-1);
  if (last?.role !== "assistant") {
    return [];
  }
  return last.parts.flatMap((part) =>
    part.type === "tool-setArticleStatus" && part.state === "approval-requested"
      ? [part.approval.id]
      : [],
  );
};

/**
 * The chat sends text only, so `PromptInput` must never pick up files: it would
 * turn them into attachments the reader cannot see and the route rejects.
 * These run in the capture phase on a wrapper and stop the event before
 * `PromptInput`'s own paste and drop handlers see it.
 */

// Every paste is stopped, whatever the clipboard holds. Office apps put a
// rendering of copied text on the clipboard next to the text, and a screenshot
// is only a file. The browser still pastes any text; only files are left out.
const keepPastedFilesOut = (event: ClipboardEvent<HTMLDivElement>) => {
  event.stopPropagation();
};

// A dropped file would otherwise open in the tab and lose the in-memory chat.
// Text drags keep the browser default.
const keepDroppedFilesOut = (event: DragEvent<HTMLDivElement>) => {
  if (event.dataTransfer.types.includes("Files")) {
    event.preventDefault();
    event.stopPropagation();
  }
};

/**
 * The vendored `InputGroup` inside `PromptInput` has a shadow and its own fill.
 * The prompt follows the app's other inputs instead: flat, `bg-muted`, with
 * the primary focus ring.
 */
const promptSurface = cn(
  "[&>[data-slot=input-group]]:bg-muted dark:[&>[data-slot=input-group]]:bg-muted [&>[data-slot=input-group]]:shadow-none",
  "[&>[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:border-primary [&>[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:ring-primary/30 [&>[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
);

const Chat = ({
  speechEngine,
  article,
  header,
}: {
  speechEngine: SpeechEngine;
  /**
   * Opens the chat on this article and asks for its text summary. Every
   * request then carries the article's id, which grounds the answers in it.
   */
  article?: { id: number; title: string };
  /** Shown above the conversation, scrolling with it. */
  header?: ReactNode;
}) => {
  // Set while a typed reply declines a pending card, so the decline goes out
  // with the reply in one request instead of on its own first.
  const decliningForReply = useRef(false);

  // One transport per article, not one per render.
  const articleTransport = useMemo(
    () => (article ? createTransport(article.id) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [article?.id],
  );

  const {
    messages,
    status,
    error,
    sendMessage,
    stop,
    regenerate,
    setMessages,
    clearError,
    addToolApprovalResponse,
  } = useChat<ChatUIMessage>({
    transport: articleTransport ?? transport,
    // Apply and Decline on a card send the conversation back so the server
    // runs (or skips) the change and the assistant can confirm it.
    sendAutomaticallyWhen: ({ messages }) =>
      !decliningForReply.current &&
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
  });

  // The navigation's unread counts are server-rendered; refresh them once per
  // applied change.
  const router = useRouter();
  const refreshedCalls = useRef(new Set<string>());
  useEffect(() => {
    let changed = false;
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          part.type === "tool-setArticleStatus" &&
          part.state === "output-available" &&
          !("error" in part.output) &&
          part.output.changed > 0 &&
          !refreshedCalls.current.has(part.toolCallId)
        ) {
          refreshedCalls.current.add(part.toolCallId);
          changed = true;
        }
      }
    }
    if (changed) {
      router.refresh();
    }
  }, [messages, router]);

  // The answer being read aloud. Only one is read at a time: reading another
  // replaces it, and the one it replaces stops as its player unmounts.
  const [readingId, setReadingId] = useState<string | undefined>(undefined);
  const stopReading = useCallback(() => setReadingId(undefined), []);

  const busy = status === "submitted" || status === "streaming";

  const send = async (text: string) => {
    if (busy || !text.trim()) {
      return;
    }
    // Typing instead of answering the cards declines them, so "no, only the
    // first three" reaches the assistant as a reply to its proposal.
    decliningForReply.current = true;
    try {
      for (const id of pendingApprovalIds(messages)) {
        await addToolApprovalResponse({
          id,
          approved: false,
          reason: DECLINED_BY_REPLY,
        });
      }
    } catch {
      // The reply still goes out. A card left in approval-requested is safe:
      // convertToModelMessages drops such a part from earlier turns.
    } finally {
      decliningForReply.current = false;
    }
    void sendMessage({ text });
  };

  // Files never get attached (see above), and the route takes text only.
  const handleSubmit = ({ text }: PromptInputMessage) => {
    void send(text);
  };

  // While answering, Enter would submit (and clear) the form without sending;
  // keep the draft instead. The submit button stops the stream meanwhile.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (busy && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
    }
  };

  const startOver = () => {
    void stop();
    clearError();
    setMessages([]);
    setReadingId(undefined);
  };

  // Asks for the text summary when the chat opens. Deferred so that
  // Strict Mode's trial unmount, which stops the chat, cancels it instead.
  const articleId = article?.id;
  const articleTitle = article?.title;
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (articleTitle === undefined || hasMessages) {
      return;
    }
    const timer = setTimeout(
      () => void sendMessage({ text: summaryRequest(articleTitle) }),
      0,
    );
    return () => clearTimeout(timer);
  }, [articleId, articleTitle, hasMessages, sendMessage]);

  const isEmpty = messages.length === 0 && !article;

  const thread = messages.map((message, index) => (
    <ChatMessage
      key={message.id}
      message={message}
      answering={busy && index === messages.length - 1}
      interrupted={
        index < messages.length - 1 ||
        (status === "error" && index === messages.length - 1)
      }
      onApprovalResponse={(response) => void addToolApprovalResponse(response)}
      actions={
        <ReadAloud
          engine={speechEngine}
          text={messageText(message)}
          reading={message.id === readingId}
          onRead={() => setReadingId(message.id)}
          onReadEnd={stopReading}
        />
      }
    />
  ));

  // The text summary takes a moment to start; the reader sees it is coming.
  const waiting = status === "submitted" && (
    <Spinner className="text-muted-foreground size-5" aria-label="Answering" />
  );

  const errorAlert =
    error &&
    (isSessionExpired(error) ? (
      <Alert variant="destructive">
        <span>
          Your session has expired.{" "}
          <Link
            href="/sign-in"
            className="font-medium underline underline-offset-4"
          >
            Sign in again
          </Link>
          .
        </span>
      </Alert>
    ) : isTooLong(error) ? (
      <Alert variant="destructive">
        <span>This conversation is too long. Start a new chat.</span>
      </Alert>
    ) : (
      <Alert
        variant="destructive"
        className="flex items-center justify-between gap-2"
      >
        <span>The answer could not be generated.</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Regenerating rewrites the last answer, which unmounts its
            // reader without ending the reading.
            stopReading();
            void regenerate();
          }}
        >
          Retry
        </Button>
      </Alert>
    ));

  const prompt = (
    <div
      className="max-w-content mx-auto w-full"
      onPasteCapture={keepPastedFilesOut}
      onDragOverCapture={keepDroppedFilesOut}
      onDropCapture={keepDroppedFilesOut}
    >
      <PromptInput
        onSubmit={handleSubmit}
        maxFiles={0}
        className={promptSurface}
      >
        <PromptInputTextarea
          aria-label={
            article ? "Ask about this article" : "Ask about your articles"
          }
          placeholder={
            article ? "Ask about this article…" : "Ask about your articles…"
          }
          onKeyDown={handleKeyDown}
        />
        <PromptInputFooter className="justify-end">
          {/* After an error the button still sends, so it keeps the Send icon. */}
          <PromptInputSubmit
            status={busy ? status : "ready"}
            onStop={() => void stop()}
            aria-label={busy ? "Stop" : "Send"}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );

  // A fresh chat centers the prompt; once there is a conversation the prompt
  // moves to the bottom. The input stays the last child either way, so React
  // keeps the same element and it does not lose focus on the first question.
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col gap-2",
        isEmpty && "justify-center gap-6 pb-[10vh]",
      )}
    >
      {isEmpty ? (
        <div className="max-w-content mx-auto flex w-full flex-col gap-1 text-center">
          <h2 className="text-xl font-semibold">
            What would you like to know?
          </h2>
          <p className="text-muted-foreground text-sm">
            Ask anything about the articles in your feeds. Answers link to the
            articles they come from.
          </p>
        </div>
      ) : (
        <div className="max-w-content mx-auto flex w-full justify-end">
          {article ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/chat">
                <PlusIcon />
                New chat
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={startOver}>
              <PlusIcon />
              New chat
            </Button>
          )}
        </div>
      )}

      <Conversation className={cn("min-h-0", isEmpty && "hidden")}>
        <ConversationContent className="max-w-content mx-auto w-full gap-6 px-0">
          {header}
          {thread}
          {waiting}
          {errorAlert}
        </ConversationContent>
        {/* The vendored button is see-through in light mode over text. */}
        <ConversationScrollButton className="bg-background" />
      </Conversation>

      {prompt}
    </div>
  );
};

export default Chat;
