"use client";

import { Message, MessageContent } from "@/components/ai-elements/message";
import StatusChangeCard, {
  type ApprovalResponse,
} from "@/components/chat/status-change-card";
import ToolActivity, {
  type ChatToolPart,
} from "@/components/chat/tool-activity";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import type { ReactNode } from "react";

const isToolPart = (
  part: ChatUIMessage["parts"][number],
): part is ChatToolPart =>
  part.type === "tool-searchArticles" || part.type === "tool-getArticle";

/** An answer's text, its parts separated like paragraphs. */
export const messageText = (message: ChatUIMessage) =>
  message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");

const ChatMessage = ({
  message,
  answering = false,
  interrupted = false,
  actions,
  onApprovalResponse,
}: {
  message: ChatUIMessage;
  /** Whether this answer is still being written. */
  answering?: boolean;
  /**
   * Whether the conversation moved on past this answer, or the request for it
   * failed, so approved changes in it will not run.
   */
  interrupted?: boolean;
  /** Controls shown under the answer once it has been written. */
  actions?: ReactNode;
  /** Answers a status-change card's Apply or Decline. */
  onApprovalResponse?: (response: ApprovalResponse) => void;
}) => {
  if (message.role === "user") {
    const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n");

    return (
      <Message from="user">
        <MessageContent className="whitespace-pre-wrap">{text}</MessageContent>
      </Message>
    );
  }

  const toolParts = message.parts.filter(isToolPart);

  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        {toolParts.length > 0 && (
          <ToolActivity parts={toolParts} answering={answering} />
        )}
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <SafeMarkdown key={index} className="text-prose">
                {part.text}
              </SafeMarkdown>
            );
          }
          if (part.type === "tool-setArticleStatus") {
            return (
              <StatusChangeCard
                key={part.toolCallId}
                part={part}
                interrupted={interrupted}
                otherPending={message.parts.some(
                  (other) =>
                    other.type === "tool-setArticleStatus" &&
                    other.toolCallId !== part.toolCallId &&
                    other.state === "approval-requested",
                )}
                onRespond={(response) => onApprovalResponse?.(response)}
              />
            );
          }
          return null;
        })}
      </MessageContent>
      {!answering && actions}
    </Message>
  );
};

export default ChatMessage;
