import { isToolUIPart, type UIMessage } from "ai";

/**
 * The whole conversation goes to the model on every question, so earlier
 * search results would be paid for again and again. Earlier turns keep only
 * which articles they found; the answers still cite their paths, and the model
 * can reopen any article with getArticle.
 *
 * The chat UI compacts before sending, so long chats stay under the route's
 * size limit; the route compacts again for bodies sent by other clients. This
 * module therefore runs in the browser too and must only import from `ai`.
 */

interface ArticleReference {
  id: number;
  title: string;
  path: string;
}

const isArticleReference = (value: unknown): value is ArticleReference =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "title" in value &&
  "path" in value;

const toReference = ({ id, title, path }: ArticleReference) => ({
  id,
  title,
  path,
});

export const compactToolOutput = (output: unknown): unknown => {
  if (typeof output !== "object" || output === null) {
    return output;
  }
  if ("results" in output && Array.isArray(output.results)) {
    return {
      results: output.results.filter(isArticleReference).map(toReference),
    };
  }
  if (isArticleReference(output)) {
    return toReference(output);
  }
  return output;
};

/** Compacts tool outputs in every message before the last user message. */
export const compactEarlierTurns = <M extends UIMessage>(
  messages: M[],
): M[] => {
  const currentTurnStart = messages.findLastIndex(
    (message) => message.role === "user",
  );

  return messages.map((message, index) =>
    index >= currentTurnStart || message.role !== "assistant"
      ? message
      : // The compacted output no longer matches the tool's output type; it
        // only goes to convertToModelMessages, which treats it as JSON.
        ({
          ...message,
          parts: message.parts.map((part) =>
            isToolUIPart(part) && part.state === "output-available"
              ? { ...part, output: compactToolOutput(part.output) }
              : part,
          ),
        } as M),
  );
};

/** What the model is told about an approved change that never ran. */
export const NOT_APPLIED_REASON = "The change was not applied.";

type MessagePart = UIMessage["parts"][number];

const isUnexecutedApproval = (
  part: MessagePart,
): part is Extract<MessagePart, { state: "approval-responded" }> =>
  isToolUIPart(part) &&
  part.state === "approval-responded" &&
  part.approval.approved === true;

/**
 * The SDK runs an approved tool call only while its message is the last one.
 * An approval left behind by a failed or abandoned request never ran, and a
 * conversation carrying it cannot be sent to the model; it becomes a denial.
 */
export const declineStaleApprovals = <M extends UIMessage>(
  messages: M[],
): M[] =>
  messages.map((message, index) =>
    index === messages.length - 1 || !message.parts.some(isUnexecutedApproval)
      ? message
      : {
          ...message,
          parts: message.parts.map((part) =>
            isUnexecutedApproval(part)
              ? {
                  ...part,
                  approval: {
                    ...part.approval,
                    approved: false,
                    reason: NOT_APPLIED_REASON,
                  },
                }
              : part,
          ),
        },
  );
