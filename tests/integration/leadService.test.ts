import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

// Mock the AI registry's top-level model and the `ai` SDK BEFORE importing the service.
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("@/lib/metrics", () => ({
  recordAiLeadGeneration: vi.fn(),
  recordLanguageModelTokens: vi.fn(),
}));
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({
    text: "Generated lead.",
    totalUsage: { inputTokens: 7, outputTokens: 3, reasoningTokens: 0 },
  })),
}));

import { buildLeadPrompt } from "@/lib/ai/prompts";
import { generateAiLead } from "@/lib/ai/services/leadService";
import { recordAiLeadGeneration } from "@/lib/metrics";
import { generateText } from "ai";

let userId: string;
let feedId: number;

beforeEach(async () => {
  vi.clearAllMocks();
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("generateAiLead", () => {
  it("stores the generated lead and records token usage", async () => {
    const article = await createArticle({ userId, feedId });

    const result = await generateAiLead(article.id);

    expect(result).toBe("Generated lead.");
    const lead = await prisma.articleLead.findUniqueOrThrow({
      where: { articleId: article.id },
    });
    expect(lead.text).toBe("Generated lead.");

    const usage = await prisma.tokenUsage.findFirstOrThrow({
      where: { userId },
    });
    expect(usage.inputTokens).toBe(7);
    expect(usage.outputTokens).toBe(3);
    expect(vi.mocked(recordAiLeadGeneration)).toHaveBeenCalledWith({
      userId,
      feedName: "Test Feed",
      status: "success",
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: buildLeadPrompt(article.title, ""),
      }),
    );
  });

  it("records a failed generation when text generation rejects", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(generateText).mockRejectedValueOnce(
      new Error("generation failed"),
    );

    await expect(generateAiLead(article.id)).rejects.toThrow(
      "generation failed",
    );

    expect(vi.mocked(recordAiLeadGeneration)).toHaveBeenCalledWith({
      userId,
      feedName: "Test Feed",
      status: "error",
    });
  });

  it("still returns the generated lead when success metrics recording fails", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(recordAiLeadGeneration).mockImplementationOnce(() => {
      throw new Error("metric failed");
    });

    const result = await generateAiLead(article.id);

    expect(result).toBe("Generated lead.");
    expect(vi.mocked(generateText)).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.not.stringContaining("Test Feed"),
      }),
    );
    const usage = await prisma.tokenUsage.findFirstOrThrow({
      where: { userId },
    });
    expect(usage.inputTokens).toBe(7);
    expect(usage.outputTokens).toBe(3);
  });
});
