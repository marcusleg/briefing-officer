import prisma from "@/lib/prismaClient";
import type { Feed } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, createFeed, createUser } from "../helpers/factories";

// --- Boundary mocks (hoisted by Vitest) ---
vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));
vi.mock("@/lib/ai/services/leadService", () => ({
  generateAiLead: vi.fn(),
}));

import { generateAiLead } from "@/lib/ai/services/leadService";
import {
  createCategory as createCategoryAction,
  createFeed as createFeedAction,
  deleteCategory,
  deleteFeed,
  getUserCategories,
  refreshCategoryFeeds,
  refreshFeed,
  refreshFeeds,
  updateCategory,
  updateFeed,
} from "@/lib/repository/feedRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { scrapeArticle, scrapeFeed } from "@/lib/scraper";

let userId: string;

const feedItem = (title: string, link: string) => ({
  title,
  link,
  description: null,
  publicationDate: new Date(),
  commentsLink: null,
});

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  vi.mocked(scrapeArticle).mockResolvedValue(undefined as never);
  vi.mocked(generateAiLead).mockResolvedValue(undefined as never);
  vi.mocked(scrapeFeed).mockResolvedValue([]);
});

describe("feedRepository.refreshFeed", () => {
  it("creates articles returned by the scraper and updates lastFetched", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
      feedItem("Second", "https://example.com/2"),
    ]);

    await refreshFeed(feed.id);

    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(2);
    const refreshed = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(refreshed.lastFetched.getTime()).toBeGreaterThan(
      new Date(0).getTime(),
    );
  });

  it("updates commentsLink on an existing article when the feed is refreshed", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("Article", "https://example.com/1"),
    ]);
    await refreshFeed(feed.id);

    const withComments = {
      ...feedItem("Article", "https://example.com/1"),
      commentsLink: "https://example.com/1#comments",
    };
    vi.mocked(scrapeFeed).mockResolvedValue([withComments]);
    await refreshFeed(feed.id);

    const article = await prisma.article.findFirstOrThrow({
      where: { feedId: feed.id },
    });
    expect(article.commentsLink).toBe("https://example.com/1#comments");
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(1);
  });

  it("does not create articles whose title matches a filter expression", async () => {
    const feed = await createFeed({ userId, titleFilterExpressions: "Sports" });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("Breaking", "https://example.com/a"),
      feedItem("Sports roundup", "https://example.com/b"),
    ]);

    await refreshFeed(feed.id);

    const titles = (
      await prisma.article.findMany({ where: { feedId: feed.id } })
    ).map((a) => a.title);
    expect(titles).toEqual(["Breaking"]);
  });
});

describe("feedRepository.refreshFeeds", () => {
  it("refreshes only auto-refresh feeds", async () => {
    const autoRefreshed = await createFeed({
      userId,
      autoRefresh: true,
      link: "https://example.com/on.xml",
    });
    const paused = await createFeed({
      userId,
      autoRefresh: false,
      link: "https://example.com/off.xml",
    });
    vi.mocked(scrapeFeed).mockImplementation(async (feed: Feed) => [
      feedItem(`Item for ${feed.id}`, `https://example.com/item-${feed.id}`),
    ]);

    await refreshFeeds();

    expect(
      await prisma.article.count({ where: { feedId: autoRefreshed.id } }),
    ).toBe(1);
    expect(await prisma.article.count({ where: { feedId: paused.id } })).toBe(
      0,
    );
  });
});

describe("feedRepository.createFeed", () => {
  it("fetches+parses the feed link, creates the row, then refreshes", async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Parsed Title</title></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(scrapeFeed).mockResolvedValue([]);

    await createFeedAction({
      title: "",
      link: "https://example.com/new.xml",
      titleFilterExpressions: "",
      autoRefresh: true,
    });

    const created = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(created.title).toBe("Parsed Title");
    expect(vi.mocked(scrapeFeed)).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("feedRepository.updateFeed", () => {
  it("updates fields and triggers a refresh", async () => {
    const feed = await createFeed({ userId, title: "Old" });
    vi.mocked(scrapeFeed).mockResolvedValue([]);

    await updateFeed(feed.id, {
      title: "New",
      link: feed.link,
      titleFilterExpressions: "",
      autoRefresh: false,
    });

    const updated = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(updated.title).toBe("New");
    expect(updated.autoRefresh).toBe(false);
  });
});

describe("feedRepository.deleteFeed", () => {
  it("deletes the feed and its articles", async () => {
    const feed = await createFeed({ userId });
    await prisma.article.create({
      data: {
        userId,
        feedId: feed.id,
        title: "A",
        link: "https://example.com/x",
        publicationDate: new Date(),
      },
    });

    await deleteFeed(feed.id);

    expect(await prisma.feed.count({ where: { id: feed.id } })).toBe(0);
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(0);
  });
});

describe("feedRepository categories", () => {
  it("creates and lists categories alphabetically", async () => {
    await createCategoryAction({ name: "Zeta" });
    await createCategoryAction({ name: "Alpha" });

    const categories = await getUserCategories();
    expect(categories.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("updates a category name", async () => {
    const category = await createCategory({ userId, name: "Old" });
    await updateCategory(category.id, { name: "Renamed" });
    const updated = await prisma.feedCategory.findUniqueOrThrow({
      where: { id: category.id },
    });
    expect(updated.name).toBe("Renamed");
  });

  it("nulls feeds' category on delete instead of deleting feeds", async () => {
    const category = await createCategory({ userId, name: "Tech" });
    const feed = await createFeed({ userId, feedCategoryId: category.id });

    await deleteCategory(category.id);

    expect(
      await prisma.feedCategory.count({ where: { id: category.id } }),
    ).toBe(0);
    const stillThere = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(stillThere.feedCategoryId).toBeNull();
  });
});

describe("feedRepository.refreshCategoryFeeds", () => {
  it("refreshes only auto-refresh feeds in the given category", async () => {
    const category = await createCategory({ userId, name: "Tech" });
    const inCategoryEnabled = await createFeed({
      userId,
      autoRefresh: true,
      feedCategoryId: category.id,
      link: "https://example.com/cat-on.xml",
    });
    const inCategoryDisabled = await createFeed({
      userId,
      autoRefresh: false,
      feedCategoryId: category.id,
      link: "https://example.com/cat-off.xml",
    });
    const outOfCategory = await createFeed({
      userId,
      autoRefresh: true,
      feedCategoryId: null,
      link: "https://example.com/no-cat.xml",
    });
    vi.mocked(scrapeFeed).mockImplementation(async (feed: Feed) => [
      feedItem(
        `Item for ${feed.id}`,
        `https://example.com/cat-item-${feed.id}`,
      ),
    ]);

    await refreshCategoryFeeds(category.id);

    expect(
      await prisma.article.count({ where: { feedId: inCategoryEnabled.id } }),
    ).toBe(1);
    expect(
      await prisma.article.count({ where: { feedId: inCategoryDisabled.id } }),
    ).toBe(0);
    expect(
      await prisma.article.count({ where: { feedId: outOfCategory.id } }),
    ).toBe(0);
  });
});
