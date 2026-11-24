"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageActions } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import ChatMessage, { messageText } from "@/components/chat/chat-message";
import { CopyAnswer } from "@/components/chat/copy-answer";
import { ReadAloud, type SpeechEngine } from "@/components/chat/read-aloud";
import type { NewTabHref } from "@/components/markdown/safe-markdown";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { articleIdFromPath, citedArticleIds } from "@/lib/ai/chat/articlePath";
import { compactEarlierTurns } from "@/lib/ai/chat/compactHistory";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { getArticleSources } from "@/lib/repository/chatRepository";
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
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { StickToBottomContext } from "use-stick-to-bottom";

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

/**
 * What the reader asks first in a chat opened on an article. It names no
 * title: the heading above shows the article, and a title is the feed's text,
 * which must not reach the model as the reader's own words.
 */
export const TEXT_SUMMARY_REQUEST = "Summarize this article.";

/**
 * Whether a chat opened on an article still shows only its text summary,
 * which the reader reads from the top. Their own first question ends that.
 */
export const showsOnlyTextSummary = (messages: ChatUIMessage[]) =>
  messages.filter((message) => message.role === "user").length < 2;

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
   * Opens the chat on this article: it asks for the text summary right away,
   * and every request carries the article's id, which grounds the answers in
   * it.
   */
  article?: { id: number };
  /** Shown above the conversation, scrolling with it. */
  header?: ReactNode;
}) => {
  // Set while a typed reply declines a pending card, so the decline goes out
  // with the reply in one request instead of on its own first.
  const decliningForReply = useRef(false);

  // A page shows one article for its whole life, so its transport is made once.
  const [chatTransport] = useState(() =>
    article ? createTransport(article.id) : transport,
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
    transport: chatTransport,
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

  const conversation = useRef<StickToBottomContext>(null);

  // Cited articles link to their sources, which come from the reader's own
  // articles once an answer is complete. Until then a citation opens the
  // article in the app, in a new tab so the conversation stays. A failed
  // lookup is tried again once the next answer is complete.
  const [sources, setSources] = useState<Record<number, string>>({});
  const lookedUp = useRef(new Set<number>());
  useEffect(() => {
    if (busy) {
      return;
    }
    const ids = messages
      .flatMap((message) =>
        message.role === "assistant"
          ? citedArticleIds(messageText(message))
          : [],
      )
      .filter((id) => !lookedUp.current.has(id));
    if (ids.length === 0) {
      return;
    }
    for (const id of ids) {
      lookedUp.current.add(id);
    }
    getArticleSources(ids)
      .then((found) => setSources((current) => ({ ...current, ...found })))
      .catch(() => {
        for (const id of ids) {
          lookedUp.current.delete(id);
        }
      });
  }, [busy, messages]);
  // A resolved citation names its site, which can add lines after the answer
  // is complete; a reader at or near the bottom is taken to the new bottom.
  useEffect(() => {
    if (conversation.current?.state.isNearBottom) {
      void conversation.current.scrollToBottom();
    }
  }, [sources]);
  // Links the model writes to other sites show as text: their address is the
  // model's, which a hostile article can choose. Every other path in the app
  // opens in a new tab, so the unsaved conversation stays.
  const newTabHref = useCallback<NewTabHref>(
    (href) => {
      const id = articleIdFromPath(href);
      if (id !== undefined) {
        return sources[id] ?? href;
      }
      if (href.startsWith("#")) {
        return undefined;
      }
      return href.startsWith("/") && !href.startsWith("//") ? href : null;
    },
    [sources],
  );

  // The text summary is asked for once the chat is open. Deferred so that
  // Strict Mode's trial unmount, which stops the chat, cancels it instead of
  // leaving it stopped.
  const opensOnArticle = article !== undefined;
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (!opensOnArticle || hasMessages) {
      return;
    }
    const timer = setTimeout(
      () => void sendMessage({ text: TEXT_SUMMARY_REQUEST }),
      0,
    );
    return () => clearTimeout(timer);
  }, [opensOnArticle, hasMessages, sendMessage]);

  // The conversation stays at the top until the reader asks a question;
  // from then on it follows the answers as usual.
  const atTop = opensOnArticle && showsOnlyTextSummary(messages);
  // The conversation keeps the first function it is given, so this one reads
  // where to stay from a ref.
  const stayAtTop = useRef(atTop);
  const scrollTarget = useCallback(
    (bottom: number) => (stayAtTop.current ? 0 : bottom),
    [],
  );
  useEffect(() => {
    if (stayAtTop.current && !atTop) {
      stayAtTop.current = false;
      void conversation.current?.scrollToBottom();
    }
  }, [atTop]);

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

  const isEmpty = messages.length === 0 && !article;

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
            sources of the articles they draw on.
          </p>
        </div>
      ) : (
        <div className="max-w-content mx-auto flex w-full justify-end">
          {article ? (
            // Starting over here would ask for the text summary again.
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

      <Conversation
        className={cn("min-h-0", isEmpty && "hidden")}
        contextRef={conversation}
        targetScrollTop={scrollTarget}
      >
        <ConversationContent className="max-w-content mx-auto w-full gap-6 px-0">
          {header}
          {messages.map((message, index) => {
            const text = messageText(message);
            return (
              <ChatMessage
                key={message.id}
                message={message}
                answering={busy && index === messages.length - 1}
                interrupted={
                  index < messages.length - 1 ||
                  (status === "error" && index === messages.length - 1)
                }
                onApprovalResponse={(response) =>
                  void addToolApprovalResponse(response)
                }
                newTabHref={newTabHref}
                actions={
                  text.trim() !== "" && (
                    <MessageActions>
                      <CopyAnswer text={text} />
                      <ReadAloud
                        engine={speechEngine}
                        text={text}
                        reading={message.id === readingId}
                        onRead={() => setReadingId(message.id)}
                        onReadEnd={stopReading}
                      />
                    </MessageActions>
                  )
                }
              />
            );
          })}

          {status === "submitted" && (
            <Spinner
              className="text-muted-foreground size-5"
              aria-label="Answering"
            />
          )}

          {error &&
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
            ))}
        </ConversationContent>
        {/* The vendored button is see-through in light mode over text. */}
        {!atTop && <ConversationScrollButton className="bg-background" />}
      </Conversation>

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
    </div>
  );
};

export default Chat;
