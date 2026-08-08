import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only parseFeed is stubbed. The scraper also parses raw element content with
// htmlparser2, and these tests assert on what that produces.
vi.mock("htmlparser2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("htmlparser2")>()),
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

import type { Feed } from "@/generated/prisma/client";
import { scrapeFeed } from "@/lib/scraper";
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

// A hook rather than a call at the end of each test: a failing assertion above
// would skip the cleanup and leak the stubbed fetch into every later test.
afterEach(() => vi.unstubAllGlobals());

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
  });

  it("assigns commentsLink by link URL, not position, when an invalid item precedes a valid one", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Bad Item (no pubDate)</title>
          <link>https://example.com/bad</link>
          <comments>https://example.com/bad#comments</comments>
        </item>
        <item>
          <title>Good Item</title>
          <link>https://example.com/good</link>
          <comments>https://example.com/good#comments</comments>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    // parseFeed skips the bad item (no pubDate) — only returns the good one
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Good Item", "https://example.com/good")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items).toHaveLength(1);
    expect(items[0].commentsLink).toBe("https://example.com/good#comments");
  });
});

describe("scrapeFeed authors", () => {
  const stubFeedSource = (xml: string, type: "rss2" | "atom" = "rss2") => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(parseFeed).mockReturnValue({
      type,
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Article 1", "https://example.com/1")],
    } as ReturnType<typeof parseFeed>);
  };

  it("reads the author from <dc:creator>", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <dc:creator><![CDATA[Jane Doe]]></dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("prefers <dc:creator> over the email in <author>", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <author>jane@example.com</author>
          <dc:creator>Jane Doe</dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("takes the name out of an RSS <author> email address", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <author>jane@example.com (Jane Doe)</author>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("joins multiple <dc:creator> elements", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <dc:creator>Jane Doe</dc:creator>
          <dc:creator>John Roe</dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe, John Roe");
  });

  it("decodes entities in the author name", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <dc:creator>Jane &amp; John O&#39;Doe</dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane & John O'Doe");
  });

  it("unwraps markup around the author name", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <dc:creator><![CDATA[<a href="https://example.com/jane">Jane Doe</a>]]></dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("leaves no tag behind when the markup is nested", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <dc:creator><![CDATA[<<b>b>Jane Doe]]></dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).not.toContain("<");
  });

  it("reads the author from an Atom entry", async () => {
    stubFeedSource(
      `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Article 1</title>
          <link href="https://example.com/1"/>
          <author><name>Jane Doe</name><email>jane@example.com</email></author>
        </entry>
      </feed>
    `,
      "atom",
    );

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("falls back to the feed-level author for Atom entries without one", async () => {
    stubFeedSource(
      `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <author><name>Jane Doe</name></author>
        <entry>
          <title>Article 1</title>
          <link href="https://example.com/1"/>
        </entry>
      </feed>
    `,
      "atom",
    );

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("prefers the entry author over the feed-level author", async () => {
    stubFeedSource(
      `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <author><name>Feed Owner</name></author>
        <entry>
          <title>Article 1</title>
          <link href="https://example.com/1"/>
          <author><name>Jane Doe</name></author>
        </entry>
      </feed>
    `,
      "atom",
    );

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBe("Jane Doe");
  });

  it("returns a null author when the feed declares none", async () => {
    stubFeedSource(`
      <rss><channel>
        <managingEditor>editor@example.com</managingEditor>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBeNull();
  });

  it("ignores an <author> embedded in the item's article content", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <content:encoded><![CDATA[
            <p>Reported live.</p>
            <author>Not An Author</author>
          ]]></content:encoded>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBeNull();
  });

  it("ignores a <dc:creator> nested below the item", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <source><dc:creator>Syndication Partner</dc:creator></source>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBeNull();
  });

  it("does not treat an item author as the feed-level author", async () => {
    stubFeedSource(`
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
        </item>
        <item>
          <title>Article 2</title>
          <link>https://example.com/2</link>
          <dc:creator>Jane Doe</dc:creator>
        </item>
      </channel></rss>
    `);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].author).toBeNull();
  });
});
