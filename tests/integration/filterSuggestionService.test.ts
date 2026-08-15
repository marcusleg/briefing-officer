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

  it("passes the feed's existing disinterests and interests in their distinct roles", async () => {
    const article = await createArticle({ userId, feedId });
    await createFeedFilter({
      feedId,
      kind: "DISINTEREST",
      text: "advertisements",
    });
    await createFeedFilter({ feedId, kind: "INTEREST", text: "kernel" });

    await suggestFilterKeywords(article.id);

    const [call] = vi.mocked(generateObject).mock.calls;
    const prompt = (call[0] as any).prompt as string;

    const excludedBlock = prompt.slice(
      prompt.indexOf("<already_excluded>"),
      prompt.indexOf("</already_excluded>"),
    );
    const wantedBlock = prompt.slice(
      prompt.indexOf("<already_wanted>"),
      prompt.indexOf("</already_wanted>"),
    );

    expect(excludedBlock).toContain("- advertisements");
    expect(excludedBlock).not.toContain("- kernel");
    expect(wantedBlock).toContain("- kernel");
    expect(wantedBlock).not.toContain("- advertisements");
  });

  it("records token usage", async () => {
    const article = await createArticle({ userId, feedId });

    await suggestFilterKeywords(article.id);

    expect(
      await prisma.tokenUsage.findFirst({ where: { userId } }),
    ).toMatchObject({ inputTokens: 5, outputTokens: 2 });
  });
});
