import type { Feed } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCategory,
  createFeed,
  createFeedFilter,
  createUser,
} from "../helpers/factories";

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
  addFeedFilter,
  createCategory as createCategoryAction,
  createFeed as createFeedAction,
  deleteCategory,
  deleteFeed,
  getUserCategories,
  refreshCategoryFeeds,
  refreshFeed,
  refreshFeeds,
  removeFeedFilter,
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
  author: null,
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

  it("persists every fetched item now that regex filtering is gone", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("Breaking", "https://example.com/a"),
      feedItem("Sports roundup", "https://example.com/b"),
    ]);

    await refreshFeed(feed.id);

    const titles = (
      await prisma.article.findMany({ where: { feedId: feed.id } })
    ).map((a) => a.title);
    expect(titles).toEqual(["Breaking", "Sports roundup"]);
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
      interests: [],
      disinterests: [],
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
      interests: [],
      disinterests: [],
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

describe("feed keyword filters", () => {
  it("writes exactly the disinterests it is given, adding none of its own", async () => {
    // Mirrors the fetch stub in "feedRepository.createFeed" above: createFeed
    // fetches and parses the feed URL before it writes anything.
    //
    // DEFAULT_DISINTERESTS is no longer merged in by createFeed itself — the
    // feed form prefills them into the submitted values instead, so the
    // reader can remove one before the feed exists. This proves createFeed
    // no longer adds them back: a feed created with only one disinterest, and
    // none of the defaults, ends up with only that one.
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(scrapeFeed).mockResolvedValue([]);

    await createFeedAction({
      title: "",
      link: "https://example.com/seeded.xml",
      interests: [],
      disinterests: ["USB driver development"],
      autoRefresh: true,
    });

    const feed = await prisma.feed.findFirstOrThrow({
      where: { userId },
      include: { filters: true },
    });

    expect(
      feed.filters
        .filter((filter) => filter.kind === "DISINTEREST")
        .map((filter) => filter.text),
    ).toEqual(["USB driver development"]);

    vi.unstubAllGlobals();
  });

  it("replaces the whole filter set on update", async () => {
    const userId = (await createUser()).id;
    vi.mocked(getUserId).mockResolvedValue(userId);
    const feed = await createFeed({ userId });
    await createFeedFilter({
      feedId: feed.id,
      kind: "INTEREST",
      text: "gone after update",
    });

    await updateFeed(feed.id, {
      title: feed.title,
      link: feed.link,
      autoRefresh: feed.autoRefresh,
      interests: ["kernel"],
      disinterests: ["usb"],
    });

    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
      orderBy: { text: "asc" },
    });

    expect(filters.map((filter) => `${filter.kind}:${filter.text}`)).toEqual([
      "INTEREST:kernel",
      "DISINTEREST:usb",
    ]);
  });

  it("does not re-seed the defaults on update", async () => {
    const userId = (await createUser()).id;
    vi.mocked(getUserId).mockResolvedValue(userId);
    const feed = await createFeed({ userId });

    await updateFeed(feed.id, {
      title: feed.title,
      link: feed.link,
      autoRefresh: feed.autoRefresh,
      interests: [],
      disinterests: [],
    });

    expect(await prisma.feedFilter.count({ where: { feedId: feed.id } })).toBe(
      0,
    );
  });
});

describe("feedRepository.addFeedFilter", () => {
  it("creates the row with the given feedId, kind, and text", async () => {
    const feed = await createFeed({ userId });

    await addFeedFilter(feed.id, "INTEREST", "kernel");

    const filter = await prisma.feedFilter.findFirstOrThrow({
      where: { feedId: feed.id },
    });
    expect(filter.feedId).toBe(feed.id);
    expect(filter.kind).toBe("INTEREST");
    expect(filter.text).toBe("kernel");
  });

  it("is idempotent: adding the same filter twice leaves exactly one row", async () => {
    const feed = await createFeed({ userId });

    await addFeedFilter(feed.id, "INTEREST", "kernel");
    await expect(
      addFeedFilter(feed.id, "INTEREST", "kernel"),
    ).resolves.not.toThrow();

    expect(await prisma.feedFilter.count({ where: { feedId: feed.id } })).toBe(
      1,
    );
  });

  it("is idempotent case-insensitively: adding a different-cased spelling leaves the original row", async () => {
    const feed = await createFeed({ userId });

    await addFeedFilter(feed.id, "INTEREST", "politics");
    await addFeedFilter(feed.id, "INTEREST", "Politics");

    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
    });
    expect(filters).toHaveLength(1);
    expect(filters[0].text).toBe("politics");
  });

  it("treats INTEREST and DISINTEREST as distinct for the same text", async () => {
    const feed = await createFeed({ userId });

    await addFeedFilter(feed.id, "INTEREST", "kernel");
    await addFeedFilter(feed.id, "DISINTEREST", "kernel");

    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
    });
    expect(filters.map((filter) => filter.kind).sort()).toEqual([
      "DISINTEREST",
      "INTEREST",
    ]);
  });
});

describe("feedRepository.removeFeedFilter", () => {
  it("deletes the matching row", async () => {
    const feed = await createFeed({ userId });
    await createFeedFilter({
      feedId: feed.id,
      kind: "INTEREST",
      text: "kernel",
    });

    await removeFeedFilter(feed.id, "INTEREST", "kernel");

    expect(await prisma.feedFilter.count({ where: { feedId: feed.id } })).toBe(
      0,
    );
  });

  it("is a no-op when nothing matches", async () => {
    const feed = await createFeed({ userId });

    await expect(
      removeFeedFilter(feed.id, "INTEREST", "does-not-exist"),
    ).resolves.not.toThrow();

    expect(await prisma.feedFilter.count({ where: { feedId: feed.id } })).toBe(
      0,
    );
  });

  it("removes only the matching kind, leaving the other kind intact", async () => {
    const feed = await createFeed({ userId });
    await createFeedFilter({
      feedId: feed.id,
      kind: "INTEREST",
      text: "kernel",
    });
    await createFeedFilter({
      feedId: feed.id,
      kind: "DISINTEREST",
      text: "kernel",
    });

    await removeFeedFilter(feed.id, "DISINTEREST", "kernel");

    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
    });
    expect(filters.map((filter) => filter.kind)).toEqual(["INTEREST"]);
  });
});
