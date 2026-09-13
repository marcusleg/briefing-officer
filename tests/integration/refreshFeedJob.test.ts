import type { Feed } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));

import { refreshFeedJob } from "@/lib/jobs/handlers/refreshFeedJob";
import { scrapeFeed } from "@/lib/scraper";

let userId: string;

const feedItem = (title: string, link: string) => ({
  title,
  link,
  description: null,
  publicationDate: new Date(),
  commentsLink: null,
  author: null,
});

beforeEach(async () => {
  userId = (await createUser()).id;
  vi.mocked(scrapeFeed).mockResolvedValue([]);
});

describe("refreshFeedJob", () => {
  it("creates articles returned by the scraper and updates lastFetched", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
      feedItem("Second", "https://example.com/2"),
    ]);

    const owner = await refreshFeedJob(feed.id);

    expect(owner).toBe(userId);
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(2);
    const refreshed = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(refreshed.lastFetched.getTime()).toBeGreaterThan(0);
  });

  it("enqueues one PROCESS_ARTICLE job per new article and none for known ones", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
    ]);
    await refreshFeedJob(feed.id);
    await prisma.job.deleteMany();

    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
      feedItem("Second", "https://example.com/2"),
    ]);
    await refreshFeedJob(feed.id);

    const jobs = await prisma.job.findMany();
    const second = await prisma.article.findFirstOrThrow({
      where: { link: "https://example.com/2" },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: "PROCESS_ARTICLE",
      targetId: second.id,
      status: "PENDING",
    });
  });

  it("updates commentsLink on an existing article", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("Article", "https://example.com/1"),
    ]);
    await refreshFeedJob(feed.id);

    vi.mocked(scrapeFeed).mockResolvedValue([
      {
        ...feedItem("Article", "https://example.com/1"),
        commentsLink: "https://example.com/1#comments",
      },
    ]);
    await refreshFeedJob(feed.id);

    const article = await prisma.article.findFirstOrThrow({
      where: { feedId: feed.id },
    });
    expect(article.commentsLink).toBe("https://example.com/1#comments");
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(1);
  });

  it("returns null and does nothing for a feed that no longer exists", async () => {
    const owner = await refreshFeedJob(999_999);

    expect(owner).toBeNull();
    expect(vi.mocked(scrapeFeed)).not.toHaveBeenCalled();
  });

  it("propagates a scraper failure and leaves lastFetched unchanged", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockRejectedValue(new Error("unreachable"));

    await expect(refreshFeedJob(feed.id)).rejects.toThrow("unreachable");

    const unchanged = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(unchanged.lastFetched.getTime()).toBe(0);
  });

  it("passes the whole feed row to the scraper", async () => {
    const feed = await createFeed({ userId });

    await refreshFeedJob(feed.id);

    const passed = vi.mocked(scrapeFeed).mock.calls[0][0] as Feed;
    expect(passed.id).toBe(feed.id);
    expect(passed.link).toBe(feed.link);
  });
});
