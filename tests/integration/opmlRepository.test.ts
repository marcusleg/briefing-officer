import prisma from "@/lib/prismaClient";
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
// after() only works inside a Next request; run the callback right away so
// the test can await the refreshes it schedules.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((callback: () => unknown) => callback()),
}));

import { DEFAULT_DISINTERESTS } from "@/lib/feedFilters";
import { exportOpml, importOpml } from "@/lib/repository/opmlRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { scrapeFeed } from "@/lib/scraper";
import { after } from "next/server";

let userId: string;

const opml = (body: string) =>
  `<?xml version="1.0"?><opml version="2.0"><head><title>t</title></head><body>${body}</body></opml>`;

const formWith = (content: string, name = "feeds.opml") => {
  const formData = new FormData();
  formData.append("file", new File([content], name, { type: "text/xml" }));
  return formData;
};

const feedOutline = (title: string, xmlUrl: string) =>
  `<outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}"/>`;

// The refreshes are scheduled with after(); awaiting its mock's return value
// waits for them.
const settleRefreshes = () =>
  Promise.all(vi.mocked(after).mock.results.map((result) => result.value));

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  vi.mocked(scrapeFeed).mockResolvedValue([]);
});

describe("opmlRepository.importOpml", () => {
  it("creates feeds and categories from the file and reports the counts", async () => {
    const result = await importOpml(
      formWith(
        opml(
          `<outline text="Tech">${feedOutline("LWN", "https://lwn.example/feed")}</outline>` +
            feedOutline("Loose", "https://loose.example/feed"),
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      imported: 2,
      skipped: 0,
      categoriesCreated: 1,
      unusable: [],
    });

    const feeds = await prisma.feed.findMany({
      where: { userId },
      include: { FeedCategory: true },
    });
    // Sorted here rather than via Prisma's `orderBy`: SQLite's default
    // collation is case-sensitive (byte order), which would put "LWN" before
    // "Loose" — not the alphabetical order a reader expects.
    expect(
      feeds
        .map(
          (feed) => [feed.title, feed.link, feed.FeedCategory?.name] as const,
        )
        .sort((a, b) =>
          a[0].localeCompare(b[0], undefined, { sensitivity: "base" }),
        ),
    ).toEqual([
      ["Loose", "https://loose.example/feed", undefined],
      ["LWN", "https://lwn.example/feed", "Tech"],
    ]);
    expect(feeds.every((feed) => feed.autoRefresh)).toBe(true);
    expect(feeds.every((feed) => feed.lastFetched.getTime() === 0)).toBe(true);
  });

  it("seeds the default disinterests on every imported feed", async () => {
    await importOpml(
      formWith(opml(feedOutline("One", "https://one.example/feed"))),
    );

    const feed = await prisma.feed.findFirstOrThrow({ where: { userId } });
    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
      orderBy: { text: "asc" },
    });
    expect(filters.map((filter) => [filter.kind, filter.text])).toEqual(
      [...DEFAULT_DISINTERESTS].sort().map((text) => ["DISINTEREST", text]),
    );
  });

  it("matches an existing category case-insensitively instead of creating a duplicate", async () => {
    const existing = await createCategory({ userId, name: "Tech" });

    const result = await importOpml(
      formWith(
        opml(
          `<outline text="tech">${feedOutline("LWN", "https://lwn.example/feed")}</outline>`,
        ),
      ),
    );

    expect(result).toMatchObject({ ok: true, categoriesCreated: 0 });
    expect(await prisma.feedCategory.count({ where: { userId } })).toBe(1);
    const feed = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(feed.feedCategoryId).toBe(existing.id);
  });

  it("creates a category once when several entries share it", async () => {
    const result = await importOpml(
      formWith(
        opml(
          `<outline text="Tech">${feedOutline("A", "https://a.example/feed")}${feedOutline("B", "https://b.example/feed")}</outline>`,
        ),
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      imported: 2,
      categoriesCreated: 1,
    });
    expect(await prisma.feedCategory.count({ where: { userId } })).toBe(1);
  });

  it("skips feeds the reader already has and leaves them untouched", async () => {
    const category = await createCategory({ userId, name: "Kept" });
    await createFeed({
      userId,
      title: "Original title",
      link: "https://lwn.example/feed",
      feedCategoryId: category.id,
    });

    const result = await importOpml(
      formWith(
        opml(
          `<outline text="Other">${feedOutline("New title", "https://lwn.example/feed")}</outline>`,
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      imported: 0,
      skipped: 1,
      categoriesCreated: 0,
      unusable: [],
    });
    const feed = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(feed.title).toBe("Original title");
    expect(feed.feedCategoryId).toBe(category.id);
    expect(await prisma.feedCategory.count({ where: { userId } })).toBe(1);
  });

  it("imports a URL listed twice in the file only once", async () => {
    const result = await importOpml(
      formWith(
        opml(
          feedOutline("First", "https://dup.example/feed") +
            feedOutline("Second", "https://dup.example/feed"),
        ),
      ),
    );

    expect(result).toMatchObject({ ok: true, imported: 1, skipped: 0 });
    expect(await prisma.feed.count({ where: { userId } })).toBe(1);
  });

  it("counts an already-subscribed URL listed twice in the file as skipped once", async () => {
    await createFeed({ userId, link: "https://dup.example/feed" });

    const result = await importOpml(
      formWith(
        opml(
          feedOutline("First", "https://dup.example/feed") +
            feedOutline("Second", "https://dup.example/feed"),
        ),
      ),
    );

    expect(result).toMatchObject({ ok: true, imported: 0, skipped: 1 });
  });

  it("reports entries whose URL is not http(s) and imports the rest", async () => {
    const result = await importOpml(
      formWith(
        opml(
          feedOutline("Broken", "not a url") +
            feedOutline("Gopher", "gopher://old.example/feed") +
            feedOutline("Fine", "https://fine.example/feed"),
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      imported: 1,
      skipped: 0,
      categoriesCreated: 0,
      unusable: ["Broken", "Gopher"],
    });
  });

  it("refreshes every imported feed after the response", async () => {
    await importOpml(
      formWith(
        opml(
          feedOutline("A", "https://a.example/feed") +
            feedOutline("B", "https://b.example/feed"),
        ),
      ),
    );
    await settleRefreshes();

    expect(scrapeFeed).toHaveBeenCalledTimes(2);
    const links = vi
      .mocked(scrapeFeed)
      .mock.calls.map(([feed]) => feed.link)
      .sort();
    expect(links).toEqual(["https://a.example/feed", "https://b.example/feed"]);
  });

  it("does not see another user's feeds as already subscribed", async () => {
    const other = await createUser();
    await createFeed({ userId: other.id, link: "https://shared.example/feed" });

    const result = await importOpml(
      formWith(opml(feedOutline("Shared", "https://shared.example/feed"))),
    );

    expect(result).toMatchObject({ ok: true, imported: 1, skipped: 0 });
    expect(await prisma.feed.count({ where: { userId } })).toBe(1);
    expect(await prisma.feed.count({ where: { userId: other.id } })).toBe(1);
  });

  it("rejects a file that is not OPML without writing anything", async () => {
    const result = await importOpml(formWith("<rss><channel/></rss>"));

    expect(result).toEqual({
      ok: false,
      error: "This file is not an OPML document.",
    });
    expect(await prisma.feed.count({ where: { userId } })).toBe(0);
    expect(after).not.toHaveBeenCalled();
  });

  it("rejects a missing or empty file", async () => {
    expect(await importOpml(new FormData())).toEqual({
      ok: false,
      error: "Choose an OPML file to import.",
    });
    expect(await importOpml(formWith(""))).toEqual({
      ok: false,
      error: "Choose an OPML file to import.",
    });
  });
});

describe("opmlRepository.exportOpml", () => {
  it("groups the user's feeds by category with uncategorised feeds at body level", async () => {
    const tech = await createCategory({ userId, name: "Tech" });
    await createFeed({
      userId,
      title: "LWN",
      link: "https://lwn.example/feed",
      feedCategoryId: tech.id,
    });
    await createFeed({
      userId,
      title: "Loose",
      link: "https://loose.example/feed",
    });

    const result = await exportOpml();

    expect(result).toContain("<title>Briefing Officer feeds</title>");
    expect(result).toContain(
      `    <outline text="Loose" title="Loose" type="rss" xmlUrl="https://loose.example/feed"/>`,
    );
    expect(result).toContain(
      `    <outline text="Tech" title="Tech">\n      <outline text="LWN" title="LWN" type="rss" xmlUrl="https://lwn.example/feed"/>\n    </outline>`,
    );
  });

  it("excludes other users' feeds and empty categories", async () => {
    const other = await createUser();
    await createFeed({
      userId: other.id,
      title: "Theirs",
      link: "https://theirs.example/feed",
    });
    await createCategory({ userId, name: "Empty" });
    await createFeed({
      userId,
      title: "Mine",
      link: "https://mine.example/feed",
    });

    const result = await exportOpml();

    expect(result).toContain("Mine");
    expect(result).not.toContain("Theirs");
    expect(result).not.toContain("Empty");
  });

  it("exports a valid document when the user has no feeds", async () => {
    const result = await exportOpml();

    expect(result).toContain("<body>\n  </body>");
  });
});
