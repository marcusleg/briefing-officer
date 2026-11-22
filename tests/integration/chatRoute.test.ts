import prisma from "@/lib/prismaClient";
import { indexArticle } from "@/lib/search/articleIndexing";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import { auth } from "@/lib/auth";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const streamOf = (chunks: LanguageModelV4StreamPart[]) => ({
  stream: simulateReadableStream({ chunks }),
});

const chatRequest = (body: unknown) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const question = (text: string) => ({
  id: "chat-1",
  trigger: "submit-message",
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text }] }],
});

let userId: string;

beforeEach(async () => {
  userId = (await createUser()).id;
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId },
  } as never);
});

describe("POST /api/chat", () => {
  it("returns 401 without a session and never calls the model", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST(chatRequest(question("Hi")));

    expect(response.status).toBe(401);
    expect(getFirstConfiguredLanguageModel).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed message list", async () => {
    const response = await POST(chatRequest({ messages: [{ nope: true }] }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for a question with anything but text and never calls the model", async () => {
    const response = await POST(
      chatRequest({
        id: "chat-1",
        trigger: "submit-message",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [
              { type: "text", text: "What is in this file?" },
              {
                type: "file",
                mediaType: "application/pdf",
                url: "https://evil.example/secret.pdf",
              },
            ],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid chat request.");
    expect(getFirstConfiguredLanguageModel).not.toHaveBeenCalled();
  });

  it("returns 413 for a body over 2 MB", async () => {
    const response = await POST(
      chatRequest(question("x".repeat(2 * 1024 * 1024 + 1))),
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("Chat request too large.");
    expect(getFirstConfiguredLanguageModel).not.toHaveBeenCalled();
  });

  it("returns 413 when Content-Length announces more than 2 MB", async () => {
    const request = chatRequest(question("Hi"));
    const response = await POST(
      new Request(request, {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(3 * 1024 * 1024),
        },
      }),
    );

    expect(response.status).toBe(413);
  });

  it("returns 503 when no AI provider is configured", async () => {
    vi.mocked(getFirstConfiguredLanguageModel).mockRejectedValue(
      new Error("No AI language model is configured."),
    );

    const response = await POST(chatRequest(question("Hi")));

    expect(response.status).toBe(503);
  });

  it("runs the search tool for the signed-in user, streams the answer and bills usage", async () => {
    const feedId = (await createFeed({ userId })).id;
    const own = await createArticle({
      userId,
      feedId,
      title: "Alphabet beats estimates",
    });
    await indexArticle(own.id);
    const otherUserId = (await createUser()).id;
    const otherFeedId = (await createFeed({ userId: otherUserId })).id;
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
      title: "Alphabet secret memo",
    });
    await indexArticle(foreign.id);

    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "searchArticles",
            input: JSON.stringify({ terms: ["Alphabet"] }),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
          },
        ]),
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Answer" },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage,
          },
        ]),
      ],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(chatRequest(question("Alphabet news?")));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Answer");
    expect(model.doStreamCalls).toHaveLength(2);
    const secondPrompt = JSON.stringify(model.doStreamCalls[1].prompt);
    expect(secondPrompt).toContain("Alphabet beats estimates");
    expect(secondPrompt).not.toContain("Alphabet secret memo");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("Today is");

    await vi.waitFor(async () => {
      expect(await prisma.tokenUsage.findMany()).toEqual([
        expect.objectContaining({
          userId,
          model: "mock-model",
          inputTokens: 20,
          outputTokens: 10,
        }),
      ]);
    });
  });

  it("makes the last allowed step text-only so the reader always gets an answer", async () => {
    const toolCall = () =>
      streamOf([
        {
          type: "tool-call",
          toolCallId: "call-x",
          toolName: "searchArticles",
          input: JSON.stringify({ terms: ["Alphabet"] }),
        },
        {
          type: "finish",
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
        },
      ]);
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: Array.from({ length: 10 }, toolCall),
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(chatRequest(question("Alphabet news?")));
    await response.text();

    expect(model.doStreamCalls).toHaveLength(10);
    expect(model.doStreamCalls[8].toolChoice).not.toEqual({ type: "none" });
    expect(model.doStreamCalls[9].toolChoice).toEqual({ type: "none" });
  });

  it("still records the usage of completed steps when a later step fails", async () => {
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "searchArticles",
            input: JSON.stringify({ terms: ["Alphabet"] }),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
          },
        ]),
        streamOf([{ type: "error", error: new Error("provider exploded") }]),
      ],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(chatRequest(question("Alphabet news?")));
    await response.text();

    await vi.waitFor(async () => {
      expect(await prisma.tokenUsage.findMany()).toEqual([
        expect.objectContaining({
          userId,
          inputTokens: 10,
          outputTokens: 5,
        }),
      ]);
    });
  });

  const statusCall = (ids: number[], status = "DISMISSED") =>
    streamOf([
      {
        type: "tool-call",
        toolCallId: "call-status",
        toolName: "setArticleStatus",
        input: JSON.stringify({ ids, status }),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
      },
    ]);

  const textAnswer = (text: string) =>
    streamOf([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: text },
      { type: "text-end", id: "t1" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
        usage,
      },
    ]);

  // The conversation as the browser sends it after the reader answered the
  // card: the assistant's tool part carries the approval response.
  const afterApproval = (
    ids: number[],
    approval: { approved: boolean; reason?: string },
  ) => ({
    id: "chat-1",
    trigger: "submit-message",
    messages: [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "Mark them as read" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "step-start" },
          {
            type: "tool-setArticleStatus",
            toolCallId: "call-status",
            state: "approval-responded",
            input: { ids, status: "DISMISSED" },
            approval: { id: "approval-1", ...approval },
          },
        ],
      },
    ],
  });

  it("holds a status change for approval and changes nothing yet", async () => {
    const feedId = (await createFeed({ userId })).id;
    const article = await createArticle({ userId, feedId });
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [statusCall([article.id])],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(chatRequest(question("Mark it as read")));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("tool-approval-request");
    expect(model.doStreamCalls).toHaveLength(1);
    const unchanged = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(unchanged.status).toBe("UNREAD");
  });

  it("applies an approved change and lets the model confirm it", async () => {
    const feedId = (await createFeed({ userId })).id;
    const article = await createArticle({ userId, feedId });
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [textAnswer("Done.")],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(
      chatRequest(afterApproval([article.id], { approved: true })),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Done.");
    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("DISMISSED");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain(
      '"changed":1',
    );
  });

  it("changes nothing after a decline and tells the model", async () => {
    const feedId = (await createFeed({ userId })).id;
    const article = await createArticle({ userId, feedId });
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [textAnswer("Okay, left them.")],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(
      chatRequest(
        afterApproval([article.id], {
          approved: false,
          reason: "The reader declined.",
        }),
      ),
    );
    await response.text();

    const unchanged = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(unchanged.status).toBe("UNREAD");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain(
      "The reader declined.",
    );
  });

  it("never changes another user's article, even when approved", async () => {
    const otherUserId = (await createUser()).id;
    const otherFeedId = (await createFeed({ userId: otherUserId })).id;
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
    });
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [textAnswer("Done.")],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(
      chatRequest(afterApproval([foreign.id], { approved: true })),
    );
    await response.text();

    const unchanged = await prisma.article.findUniqueOrThrow({
      where: { id: foreign.id },
    });
    expect(unchanged.status).toBe("UNREAD");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain(
      '"notFound":1',
    );
  });

  // The approval responses above followed by a typed reply from the reader.
  const thenReply = (
    conversation: ReturnType<typeof afterApproval>,
    text: string,
  ) => ({
    ...conversation,
    messages: [
      ...conversation.messages,
      { id: "m2", role: "user", parts: [{ type: "text", text }] },
    ],
  });

  it("approved but never applied, then a reply: answers without applying it", async () => {
    const feedId = (await createFeed({ userId })).id;
    const article = await createArticle({ userId, feedId });
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [textAnswer("Okay.")],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(
      chatRequest(
        thenReply(
          afterApproval([article.id], { approved: true }),
          "never mind",
        ),
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Okay.");
    expect(model.doStreamCalls).toHaveLength(1);
    const unchanged = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(unchanged.status).toBe("UNREAD");
    const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(prompt).toContain("The change was not applied.");
    expect(prompt).toContain("never mind");
  });

  it("a decline sent together with a typed reply: answers and changes nothing", async () => {
    const feedId = (await createFeed({ userId })).id;
    const article = await createArticle({ userId, feedId });
    const model = new MockLanguageModelV4({
      modelId: "mock-model",
      doStream: [textAnswer("Only the first, then.")],
    });
    vi.mocked(getFirstConfiguredLanguageModel).mockResolvedValue(model);

    const response = await POST(
      chatRequest(
        thenReply(
          afterApproval([article.id], {
            approved: false,
            reason: "The reader replied instead of approving.",
          }),
          "only the first",
        ),
      ),
    );
    await response.text();

    expect(response.status).toBe(200);
    const unchanged = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(unchanged.status).toBe("UNREAD");
    const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(prompt).toContain("The reader replied instead of approving.");
    expect(prompt).toContain("only the first");
  });
});
