import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("htmlparser2", () => ({
  parseFeed: vi.fn(),
}));

vi.mock("@/lib/prismaClient", () => {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    default: {
      articleLead: { deleteMany },
      articleScrape: { deleteMany },
      tokenUsage: { deleteMany },
      article: { deleteMany },
      feed: { deleteMany },
      feedCategory: { deleteMany },
      session: { deleteMany },
      account: { deleteMany },
      verification: { deleteMany },
      user: { deleteMany },
    },
  };
});
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/ai/services/leadService", () => ({ generateAiLead: vi.fn() }));

import { scrapeFeed } from "@/lib/scraper";
import type { Feed } from "@prisma/client";
import { parseFeed } from "htmlparser2";

const makeFeed = (link = "https://example.com/feed.xml"): Feed =>
  ({
    id: 1,
    title: "Test Feed",
    link,
    userId: "user-1",
    autoRefresh: true,
    lastFetched: new Date(0),
    createdAt: new Date(),
    updatedAt: new Date(),
    titleFilterExpressions: "",
    feedCategoryId: null,
  }) as Feed;

const makeRssItem = (title: string, link: string) => ({
  title,
  link,
  description: "desc",
  pubDate: new Date(),
  media: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scrapeFeed", () => {
  it("returns commentsLink when RSS item has <comments> element", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <comments>https://example.com/1#comments</comments>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Article 1", "https://example.com/1")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items).toHaveLength(1);
    expect(items[0].commentsLink).toBe("https://example.com/1#comments");
    vi.unstubAllGlobals();
  });

  it("returns null commentsLink when RSS item has no <comments> element", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Article 1", "https://example.com/1")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items).toHaveLength(1);
    expect(items[0].commentsLink).toBeNull();
    vi.unstubAllGlobals();
  });

  it("assigns commentsLink correctly when only some items have <comments>", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <comments>https://example.com/1#comments</comments>
        </item>
        <item>
          <title>Article 2</title>
          <link>https://example.com/2</link>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [
        makeRssItem("Article 1", "https://example.com/1"),
        makeRssItem("Article 2", "https://example.com/2"),
      ],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].commentsLink).toBe("https://example.com/1#comments");
    expect(items[1].commentsLink).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns null commentsLink for Atom feeds (no <comments> element)", async () => {
    const xml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom Article</title>
          <link href="https://example.com/atom/1"/>
        </entry>
      </feed>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(parseFeed).mockReturnValue({
      type: "atom",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Atom Article", "https://example.com/atom/1")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].commentsLink).toBeNull();
    vi.unstubAllGlobals();
  });
});
