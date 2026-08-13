import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

// Mock the AI registry's top-level model and the `ai` SDK BEFORE importing the service.
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: { language: "en", lead: "Generated lead." },
    usage: { inputTokens: 7, outputTokens: 3 },
  })),
}));

import { generateAiLead } from "@/lib/ai/services/leadService";

const mockGeneration = (language: string, lead = "Generated lead.") =>
  vi.mocked(generateObject).mockResolvedValueOnce({
    object: { language, lead },
    usage: { inputTokens: 7, outputTokens: 3 },
  } as never);

const mockVerdict = (
  matchesInterests: boolean,
  relevanceReason: string,
  lead = "Generated lead.",
) =>
  vi.mocked(generateObject).mockResolvedValueOnce({
    object: { language: "en", lead, relevanceReason, matchesInterests },
    usage: { inputTokens: 7, outputTokens: 3 },
  } as never);

let userId: string;
let feedId: number;

beforeEach(async () => {
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
  });

  it("stores the language the model reported", async () => {
    const article = await createArticle({ userId, feedId });
    mockGeneration("de");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.language).toBe("de");
  });

  it("normalises a regional tag before storing it", async () => {
    const article = await createArticle({ userId, feedId });
    mockGeneration("de-DE");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.language).toBe("de");
  });

  it("stores no language when the model reports it as undetermined", async () => {
    const article = await createArticle({ userId, feedId });
    mockGeneration("und");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.language).toBeNull();
  });

  it("keeps the lead when the reported language is unusable", async () => {
    // A bad language code must not cost the reader their lead.
    const article = await createArticle({ userId, feedId });
    mockGeneration("German", "Trotzdem ein Lead.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { lead: true },
    });
    expect(stored.language).toBeNull();
    expect(stored.lead?.text).toBe("Trotzdem ein Lead.");
  });

  it("replaces an existing lead rather than failing", async () => {
    const article = await createArticle({ userId, feedId });
    await generateAiLead(article.id);
    mockGeneration("fr", "Un nouveau lead.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { lead: true },
    });
    expect(stored.lead?.text).toBe("Un nouveau lead.");
    expect(stored.language).toBe("fr");
  });
});

describe("relevance filtering", () => {
  it("leaves the article unread when the feed has no interest profile", async () => {
    const article = await createArticle({ userId, feedId });

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.status).toBe("UNREAD");
    expect(stored.filterReason).toBeNull();
  });

  it("filters the article and records the reason when it does not match", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const article = await createArticle({ userId, feedId: filteredFeedId });
    mockVerdict(false, "This is a funding round announcement.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { lead: true },
    });
    expect(stored.status).toBe("FILTERED");
    expect(stored.filterReason).toBe("This is a funding round announcement.");
    expect(stored.lead?.text).toBe("Generated lead.");
  });

  it("sets statusChangedAt when it filters", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const longAgo = new Date("2020-01-01T00:00:00.000Z");
    const article = await createArticle({
      userId,
      feedId: filteredFeedId,
      statusChangedAt: longAgo,
    });
    mockVerdict(false, "Off topic.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.statusChangedAt.getTime()).toBeGreaterThan(longAgo.getTime());
  });

  it("leaves the article unread when the model call throws", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const article = await createArticle({ userId, feedId: filteredFeedId });
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("provider down"));

    await expect(generateAiLead(article.id)).rejects.toThrow("provider down");

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.status).toBe("UNREAD");
  });

  it("leaves the article unread when it does match", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const article = await createArticle({ userId, feedId: filteredFeedId });
    mockVerdict(true, "Directly about query planners.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.status).toBe("UNREAD");
    expect(stored.filterReason).toBeNull();
  });
});
