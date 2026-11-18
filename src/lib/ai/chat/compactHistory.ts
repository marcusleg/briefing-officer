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
