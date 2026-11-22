import {
  compactEarlierTurns,
  compactToolOutput,
  declineStaleApprovals,
  NOT_APPLIED_REASON,
} from "@/lib/ai/chat/compactHistory";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

const fullResult = {
  id: 2,
  title: "Alphabet beats estimates",
  feed: "Markets Daily",
  published: "2026-04-25",
  status: "UNREAD",
  archived: false,
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

  it("keeps a status change's output as it is", () => {
    const output = {
      status: "READ",
      changed: 2,
      alreadyInStatus: 1,
      notFound: 0,
    };

    expect(compactToolOutput(output)).toEqual(output);
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

describe("declineStaleApprovals", () => {
  const user = (id: string, text: string): UIMessage => ({
    id,
    role: "user",
    parts: [{ type: "text", text }],
  });
  const statusPart = (state: string, extra: Record<string, unknown> = {}) => ({
    type: "tool-setArticleStatus",
    toolCallId: `call-${state}`,
    state,
    input: { ids: [1], status: "READ" },
    ...extra,
  });
  const approved = statusPart("approval-responded", {
    approval: { id: "approval-1", approved: true },
  });
  const assistant = (id: string, parts: unknown[]): UIMessage =>
    ({ id, role: "assistant", parts }) as UIMessage;

  it("turns an approved change that never ran into a denial", () => {
    const messages = [
      user("u1", "Mark it read"),
      assistant("a1", [{ type: "text", text: "Proposing" }, approved]),
      user("u2", "never mind"),
    ];

    const result = declineStaleApprovals(messages);

    expect(result[1].parts[1]).toEqual({
      ...approved,
      approval: {
        id: "approval-1",
        approved: false,
        reason: NOT_APPLIED_REASON,
      },
    });
    expect(result[1].parts[0]).toBe(messages[1].parts[0]);
    expect(result[0]).toBe(messages[0]);
    expect(result[2]).toBe(messages[2]);
  });

  it("leaves the last message alone", () => {
    const messages = [user("u1", "Mark it read"), assistant("a1", [approved])];

    const result = declineStaleApprovals(messages);

    expect(result[1]).toBe(messages[1]);
  });

  it("leaves declined, requested and finished changes alone", () => {
    const declined = statusPart("approval-responded", {
      approval: { id: "approval-2", approved: false, reason: "No." },
    });
    const requested = statusPart("approval-requested", {
      approval: { id: "approval-3" },
    });
    const finished = statusPart("output-available", {
      approval: { id: "approval-4", approved: true },
      output: { status: "READ", changed: 1, alreadyInStatus: 0, notFound: 0 },
    });
    const messages = [
      user("u1", "Mark it read"),
      assistant("a1", [declined, requested, finished]),
      user("u2", "Thanks"),
    ];

    const result = declineStaleApprovals(messages);

    expect(result[1].parts).toEqual(messages[1].parts);
  });

  it("does not mutate its input", () => {
    const messages = [
      user("u1", "Mark it read"),
      assistant("a1", [approved]),
      user("u2", "never mind"),
    ];
    const before = structuredClone(messages);

    declineStaleApprovals(messages);

    expect(messages).toEqual(before);
  });
});
