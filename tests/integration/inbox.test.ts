import { getInboxArticles } from "@/lib/inbox";
import { beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  const feed = await createFeed({ userId });
  feedId = feed.id;
});

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

describe("getInboxArticles", () => {
  it("splits unread and read later articles, each newest first", async () => {
    await createArticle({
      userId,
      feedId,
      title: "unread old",
      publicationDate: day(1),
    });
    await createArticle({
      userId,
      feedId,
      title: "later newest",
      status: "READ_LATER",
      publicationDate: day(20),
    });
    await createArticle({
      userId,
      feedId,
      title: "unread new",
      publicationDate: day(10),
    });
    await createArticle({
      userId,
      feedId,
      title: "later old",
      status: "READ_LATER",
      publicationDate: day(2),
    });

    const { unread, readLater } = await getInboxArticles(userId);

    expect(unread.map((article) => article.title)).toEqual([
      "unread new",
      "unread old",
    ]);
    expect(readLater.map((article) => article.title)).toEqual([
      "later newest",
      "later old",
    ]);
  });

  it("leaves out read and filtered articles", async () => {
    await createArticle({ userId, feedId, title: "unread" });
    await createArticle({ userId, feedId, title: "read", status: "READ" });
    await createArticle({
      userId,
      feedId,
      title: "filtered",
      status: "FILTERED",
    });

    const { unread, readLater } = await getInboxArticles(userId);

    expect(unread.map((article) => article.title)).toEqual(["unread"]);
    expect(readLater).toEqual([]);
  });

  it("leaves out other users' articles", async () => {
    const other = await createUser();
    const otherFeed = await createFeed({ userId: other.id });
    await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      title: "someone else's unread",
    });
    await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      title: "someone else's later",
      status: "READ_LATER",
    });
    await createArticle({ userId, feedId, title: "mine" });

    const { unread, readLater } = await getInboxArticles(userId);

    expect(unread.map((article) => article.title)).toEqual(["mine"]);
    expect(readLater).toEqual([]);
  });

  it("includes the feed, lead and scrape the article list renders", async () => {
    await createArticle({ userId, feedId });

    const {
      unread: [article],
    } = await getInboxArticles(userId);

    expect(article.feed.id).toBe(feedId);
    expect(article).toHaveProperty("lead", null);
    expect(article).toHaveProperty("scrape", null);
  });
});
