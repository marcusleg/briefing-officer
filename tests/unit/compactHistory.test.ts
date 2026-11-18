import {
  compactEarlierTurns,
  compactToolOutput,
} from "@/lib/ai/chat/compactHistory";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

const fullResult = {
  id: 2,
  title: "Alphabet beats estimates",
  feed: "Markets Daily",
  published: "2026-04-25",
  status: "UNREAD",
  starred: false,
  lead: "Revenue rose 12%.",
  snippet: "…GOOGL rose…",
  path: "/feed/1/article/2/text-summary",
};
const reference = {
  id: 2,
  title: "Alphabet beats estimates",
  path: "/feed/1/article/2/text-summary",
};

describe("compactToolOutput", () => {
  it("keeps only id, title and path of search results", () => {
    expect(compactToolOutput({ results: [fullResult] })).toEqual({
      results: [reference],
    });
  });

  it("keeps only id, title and path of an opened article", () => {
    expect(
      compactToolOutput({
        ...fullResult,
        link: "https://example.com",
        text: "x".repeat(5000),
        truncated: false,
      }),
    ).toEqual(reference);
  });

  it("leaves errors and unknown shapes alone", () => {
    expect(compactToolOutput({ error: "not found" })).toEqual({
      error: "not found",
    });
    expect(compactToolOutput("text")).toBe("text");
  });
});

describe("compactEarlierTurns", () => {
  const user = (id: string, text: string): UIMessage => ({
    id,
    role: "user",
    parts: [{ type: "text", text }],
  });
  const assistant = (id: string): UIMessage =>
    ({
      id,
      role: "assistant",
      parts: [
        {
          type: "tool-searchArticles",
          toolCallId: `${id}-call`,
          state: "output-available",
          input: { terms: ["Alphabet"] },
          output: { results: [fullResult] },
        },
        { type: "text", text: "Answer [link](/feed/1/article/2/text-summary)" },
      ],
    }) as UIMessage;

  it("compacts tool outputs before the last user message only", () => {
    const messages = [
      user("u1", "First"),
      assistant("a1"),
      user("u2", "Second"),
      assistant("a2"),
    ];

    const compacted = compactEarlierTurns(messages);

    expect(compacted[1].parts[0]).toMatchObject({
      output: { results: [reference] },
    });
    expect(compacted[1].parts[1]).toEqual(messages[1].parts[1]);
    expect(compacted[3]).toBe(messages[3]);
    expect(compacted[0]).toBe(messages[0]);
  });

  it("does not mutate its input", () => {
    const messages = [user("u1", "First"), assistant("a1"), user("u2", "x")];
    const before = structuredClone(messages);

    compactEarlierTurns(messages);

    expect(messages).toEqual(before);
  });
});
