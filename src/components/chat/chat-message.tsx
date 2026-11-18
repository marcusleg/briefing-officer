"use client";

import { Message, MessageContent } from "@/components/ai-elements/message";
import ToolActivity, {
  type ChatToolPart,
} from "@/components/chat/tool-activity";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";

const isToolPart = (
  part: ChatUIMessage["parts"][number],
): part is ChatToolPart =>
  part.type === "tool-searchArticles" || part.type === "tool-getArticle";

const ChatMessage = ({ message }: { message: ChatUIMessage }) => {
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
        {toolParts.length > 0 && <ToolActivity parts={toolParts} />}
        {message.parts.map((part, index) =>
          part.type === "text" ? (
            <SafeMarkdown key={index} className="text-prose">
              {part.text}
            </SafeMarkdown>
          ) : null,
        )}
      </MessageContent>
    </Message>
  );
};

export default ChatMessage;
