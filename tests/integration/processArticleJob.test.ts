import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));
vi.mock("@/lib/ai/services/leadService", () => ({
  generateAiLead: vi.fn(),
}));

import { generateAiLead } from "@/lib/ai/services/leadService";
import { processArticleJob } from "@/lib/jobs/handlers/processArticleJob";
import { scrapeArticle } from "@/lib/scraper";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
  vi.mocked(scrapeArticle).mockResolvedValue(undefined as never);
  vi.mocked(generateAiLead).mockResolvedValue("lead");
});

describe("processArticleJob", () => {
  it("scrapes then generates the lead and returns the owner", async () => {
    const article = await createArticle({ userId, feedId });

    const owner = await processArticleJob(article.id);

    expect(owner).toBe(userId);
    expect(scrapeArticle).toHaveBeenCalledWith(article.id, article.link);
    expect(generateAiLead).toHaveBeenCalledWith(article.id);
  });

  it("skips scraping when a scrape already exists", async () => {
    const article = await createArticle({ userId, feedId });
    await prisma.articleScrape.create({
      data: { articleId: article.id, textContent: "body", author: "" },
    });

    await processArticleJob(article.id);

    expect(scrapeArticle).not.toHaveBeenCalled();
    expect(generateAiLead).toHaveBeenCalledWith(article.id);
  });

  it("still generates the lead when scraping fails", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(scrapeArticle).mockRejectedValue(new Error("404"));

    const owner = await processArticleJob(article.id);

    expect(owner).toBe(userId);
    expect(generateAiLead).toHaveBeenCalledWith(article.id);
  });

  it("propagates a lead generation failure", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(generateAiLead).mockRejectedValue(new Error("rate limited"));

    await expect(processArticleJob(article.id)).rejects.toThrow("rate limited");
  });

  it("returns null and does nothing for a missing article", async () => {
    const owner = await processArticleJob(999_999);

    expect(owner).toBeNull();
    expect(scrapeArticle).not.toHaveBeenCalled();
    expect(generateAiLead).not.toHaveBeenCalled();
  });
});
