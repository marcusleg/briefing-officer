import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("@/lib/metrics", () => ({
  recordAiSummaryGeneration: vi.fn(),
}));
vi.mock("@/lib/ai/services/tokenUsageService", () => ({
  trackTokenUsage: vi.fn(),
}));
vi.mock("@ai-sdk/rsc", () => ({
  createStreamableValue: vi.fn(() => {
    const value = "stream-value";
    return {
      value,
      update: vi.fn(),
      done: vi.fn(),
    };
  }),
}));
vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield "Summary part 1";
      yield "Summary part 2";
    })(),
    totalUsage: { inputTokens: 11, outputTokens: 4 },
  })),
}));

import { buildSummaryPrompt } from "@/lib/ai/prompts";
import { streamAiSummary } from "@/lib/ai/services/summaryService";
import { trackTokenUsage } from "@/lib/ai/services/tokenUsageService";
import { recordAiSummaryGeneration } from "@/lib/metrics";
import { getUserId } from "@/lib/repository/userRepository";
import { createStreamableValue } from "@ai-sdk/rsc";
import { streamText } from "ai";

let userId: string;
let feedId: number;
let lastStream: {
  done: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  vi.clearAllMocks();
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId, title: "Tech Feed" })).id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  vi.mocked(createStreamableValue).mockImplementation(() => {
    lastStream = {
      done: vi.fn(),
    };
    return {
      value: "stream-value",
      update: vi.fn(),
      done: lastStream.done,
    };
  });
});

describe("streamAiSummary", () => {
  it("records success metrics and token usage after streaming", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });

    const result = await streamAiSummary(article.id);

    expect(result.output).toBe("stream-value");
    expect(vi.mocked(streamText)).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: buildSummaryPrompt(article.title, ""),
      }),
    );
    expect(vi.mocked(streamText).mock.calls[0]?.[0]?.prompt).not.toContain(
      "Tech Feed",
    );

    await vi.waitFor(() => {
      expect(vi.mocked(recordAiSummaryGeneration)).toHaveBeenCalledWith({
        userId,
        feedName: "Tech Feed",
        status: "success",
      });
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledWith(
        userId,
        "test-model",
        11,
        4,
      );
    });
  });

  it("records an error when streaming fails", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });
    vi.mocked(streamText).mockImplementationOnce(() => {
      throw new Error("stream failed");
    });

    await streamAiSummary(article.id);

    await vi.waitFor(() =>
      expect(vi.mocked(recordAiSummaryGeneration)).toHaveBeenCalledWith({
        userId,
        feedName: "Tech Feed",
        status: "error",
      }),
    );
  });

  it("still tracks token usage and finishes the stream when success metrics fail", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });
    vi.mocked(recordAiSummaryGeneration).mockImplementation(() => {
      throw new Error("metric failed");
    });

    await streamAiSummary(article.id);

    await vi.waitFor(() =>
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledWith(
        userId,
        "test-model",
        11,
        4,
      ),
    );

    expect(lastStream.done).toHaveBeenCalled();
  });

  it("does not record success when token usage retrieval fails after streaming completes", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });
    vi.mocked(streamText).mockImplementationOnce(() => ({
      textStream: (async function* () {
        yield "Summary part 1";
        yield "Summary part 2";
      })(),
      totalUsage: Promise.reject(new Error("usage failed")),
    }));

    await streamAiSummary(article.id);

    await vi.waitFor(() => expect(lastStream.done).toHaveBeenCalled());
    expect(vi.mocked(recordAiSummaryGeneration)).not.toHaveBeenCalledWith({
      userId,
      feedName: "Tech Feed",
      status: "success",
    });
    expect(vi.mocked(recordAiSummaryGeneration)).not.toHaveBeenCalledWith({
      userId,
      feedName: "Tech Feed",
      status: "error",
    });
    expect(vi.mocked(trackTokenUsage)).not.toHaveBeenCalled();
    expect(lastStream.done).toHaveBeenCalled();
  });

  it("does not record success when token usage tracking fails after streaming completes", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });
    vi.mocked(trackTokenUsage).mockRejectedValueOnce(
      new Error("token tracking failed"),
    );

    await streamAiSummary(article.id);

    await vi.waitFor(() =>
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledWith(
        userId,
        "test-model",
        11,
        4,
      ),
    );
    expect(vi.mocked(recordAiSummaryGeneration)).not.toHaveBeenCalledWith({
      userId,
      feedName: "Tech Feed",
      status: "success",
    });
    expect(vi.mocked(recordAiSummaryGeneration)).not.toHaveBeenCalledWith({
      userId,
      feedName: "Tech Feed",
      status: "error",
    });
    expect(lastStream.done).toHaveBeenCalled();
  });

  it("records success when success metrics fail after token usage is tracked", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });
    vi.mocked(recordAiSummaryGeneration).mockImplementationOnce(() => {
      throw new Error("metric failed");
    });

    await streamAiSummary(article.id);

    await vi.waitFor(() =>
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledWith(
        userId,
        "test-model",
        11,
        4,
      ),
    );
    expect(lastStream.done).toHaveBeenCalled();
  });

  it("records an error when the text stream throws during iteration", async () => {
    const article = await createArticle({ userId, feedId, title: "article" });
    vi.mocked(streamText).mockImplementationOnce(() => ({
      textStream: (async function* () {
        yield "Summary part 1";
        throw new Error("iteration failed");
      })(),
      totalUsage: { inputTokens: 11, outputTokens: 4 },
    }));

    await streamAiSummary(article.id);

    await vi.waitFor(() =>
      expect(vi.mocked(recordAiSummaryGeneration)).toHaveBeenCalledWith({
        userId,
        feedName: "Tech Feed",
        status: "error",
      }),
    );
    expect(lastStream.done).toHaveBeenCalled();
  });
});
