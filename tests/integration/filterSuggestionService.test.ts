import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createArticle,
  createFeed,
  createFeedFilter,
  createUser,
} from "../helpers/factories";

vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: { suggestions: ["narrow", "medium", "broad"] },
    usage: { inputTokens: 5, outputTokens: 2 },
  })),
}));

import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("suggestFilterKeywords", () => {
  it("returns the three generated suggestions", async () => {
    const article = await createArticle({ userId, feedId });

    expect(await suggestFilterKeywords(article.id)).toEqual([
      "narrow",
      "medium",
      "broad",
    ]);
  });

  it("prompts with the stored lead when there is one", async () => {
    const article = await createArticle({ userId, feedId });
    await prisma.articleLead.create({
      data: { articleId: article.id, text: "The stored lead." },
    });

    await suggestFilterKeywords(article.id);

    const [call] = vi.mocked(generateObject).mock.calls;
    expect((call[0] as any).prompt).toContain("The stored lead.");
  });

  it("passes the feed's existing disinterests so they are not repeated", async () => {
    const article = await createArticle({ userId, feedId });
    await createFeedFilter({
      feedId,
      kind: "DISINTEREST",
      text: "advertisements",
    });
    await createFeedFilter({ feedId, kind: "INTEREST", text: "kernel" });

    await suggestFilterKeywords(article.id);

    const [call] = vi.mocked(generateObject).mock.calls;
    expect((call[0] as any).prompt).toContain("- advertisements");
    expect((call[0] as any).prompt).not.toContain("- kernel");
  });

  it("records token usage", async () => {
    const article = await createArticle({ userId, feedId });

    await suggestFilterKeywords(article.id);

    expect(
      await prisma.tokenUsage.findFirst({ where: { userId } }),
    ).toMatchObject({ inputTokens: 5, outputTokens: 2 });
  });
});
