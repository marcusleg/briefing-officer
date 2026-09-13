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

let userId: string;

const queuedRefreshes = async () =>
  (
    await prisma.job.findMany({
      where: { kind: "REFRESH_FEED" },
      orderBy: { targetId: "asc" },
    })
  ).map((job) => job.targetId);

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
});

describe("feedRepository.refreshFeed", () => {
  it("queues a refresh job for the reader's feed and returns at once", async () => {
    const feed = await createFeed({ userId, autoRefresh: false });

    await refreshFeed(feed.id);

    expect(await queuedRefreshes()).toEqual([feed.id]);
    const untouched = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(untouched.lastFetched.getTime()).toBe(0);
  });

  it("refuses a feed that belongs to someone else", async () => {
    const other = await createUser();
    const feed = await createFeed({ userId: other.id });

    await expect(refreshFeed(feed.id)).rejects.toThrow("Feed not found");
    expect(await prisma.job.count()).toBe(0);
  });
});

describe("feedRepository.refreshFeeds", () => {
  it("queues only the reader's auto-refresh feeds", async () => {
    const autoRefreshed = await createFeed({
      userId,
      autoRefresh: true,
      link: "https://example.com/on.xml",
    });
    await createFeed({
      userId,
      autoRefresh: false,
      link: "https://example.com/off.xml",
    });
    const other = await createUser();
    await createFeed({ userId: other.id, autoRefresh: true });

    await refreshFeeds();

    expect(await queuedRefreshes()).toEqual([autoRefreshed.id]);
  });
});

describe("feedRepository.createFeed", () => {
  it("fetches+parses the feed link, creates the row, then queues a refresh", async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Parsed Title</title></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );

    await createFeedAction({
      title: "",
      link: "https://example.com/new.xml",
      interests: [],
      disinterests: [],
      autoRefresh: true,
    });

    const created = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(created.title).toBe("Parsed Title");
    expect(await queuedRefreshes()).toEqual([created.id]);
    vi.unstubAllGlobals();
  });
});

describe("feedRepository.updateFeed", () => {
  it("updates fields and queues a refresh", async () => {
    const feed = await createFeed({ userId, title: "Old" });

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
    expect(await queuedRefreshes()).toEqual([feed.id]);
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
  it("queues only auto-refresh feeds in the given category", async () => {
    const category = await createCategory({ userId, name: "Tech" });
    const inCategoryEnabled = await createFeed({
      userId,
      autoRefresh: true,
      feedCategoryId: category.id,
      link: "https://example.com/cat-on.xml",
    });
    await createFeed({
      userId,
      autoRefresh: false,
      feedCategoryId: category.id,
      link: "https://example.com/cat-off.xml",
    });
    await createFeed({
      userId,
      autoRefresh: true,
      feedCategoryId: null,
      link: "https://example.com/no-cat.xml",
    });

    await refreshCategoryFeeds(category.id);

    expect(await queuedRefreshes()).toEqual([inCategoryEnabled.id]);
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
