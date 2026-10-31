import prisma from "@/lib/prismaClient";
import {
  markArticleAsNotInteresting,
  markArticleAsRead,
  markArticleAsReadLater,
  markArticleAsStarred,
  markArticlesOlderThanXDaysAsRead,
  restoreArticleStatus,
  restoreArticleToInbox,
  unmarkArticleAsReadLater,
  unmarkArticleAsStarred,
} from "@/lib/repository/articleRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));

let userId: string;
let feedId: number;

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  const feed = await createFeed({ userId });
  feedId = feed.id;
});

describe("articleRepository", () => {
  it("marks an article as read", async () => {
    const article = await createArticle({
      userId,
      feedId,
      status: "READ_LATER",
    });

    await markArticleAsRead(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("READ");
  });

  it("marks an article as read later", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsReadLater(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("READ_LATER");
  });

  it.each(["READ", "FILTERED"] as const)(
    "returns a %s article to the inbox",
    async (status) => {
      const article = await createArticle({
        userId,
        feedId,
        status,
        filterReason: status === "FILTERED" ? "Off topic." : null,
      });

      await restoreArticleToInbox(article.id);

      const updated = await prisma.article.findUniqueOrThrow({
        where: { id: article.id },
      });
      expect(updated.status).toBe("UNREAD");
      if (status === "FILTERED") {
        expect(updated.filterReason).toBe("Off topic.");
      }
    },
  );

  it("files a reader rejection as FILTERED with a reason", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsNotInteresting(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });

    expect(updated.status).toBe("FILTERED");
    expect(updated.filterReason).toBe("You marked this as not interested.");
  });

  it("moves statusChangedAt forward on every status change", async () => {
    const longAgo = new Date("2020-01-01T00:00:00.000Z");
    const article = await createArticle({
      userId,
      feedId,
      statusChangedAt: longAgo,
    });

    await markArticleAsRead(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.statusChangedAt.getTime()).toBeGreaterThan(
      longAgo.getTime(),
    );
  });

  it("stars and unstars an article", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsStarred(article.id);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: article.id } }))
        .starred,
    ).toBe(true);

    await unmarkArticleAsStarred(article.id);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: article.id } }))
        .starred,
    ).toBe(false);
  });

  it("enforces the unique (userId, feedId, link) constraint", async () => {
    await createArticle({ userId, feedId, link: "https://example.com/dup" });
    await expect(
      createArticle({ userId, feedId, link: "https://example.com/dup" }),
    ).rejects.toThrow();
  });

  it("orders read articles most-recently-read first", async () => {
    const oldest = await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newest = await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const middle = await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    await createArticle({ userId, feedId, status: "UNREAD" });
    await createArticle({ userId, feedId, status: "READ_LATER" });

    const history = await prisma.article.findMany({
      where: { status: "READ", userId },
      orderBy: { statusChangedAt: "desc" },
    });

    expect(history.map((a) => a.id)).toEqual([newest.id, middle.id, oldest.id]);
  });

  it("does not move statusChangedAt when only starred changes", async () => {
    const readAtTime = new Date("2026-01-01T00:00:00.000Z");
    const article = await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: readAtTime,
    });

    await markArticleAsStarred(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.statusChangedAt.getTime()).toBe(readAtTime.getTime());
  });
});

describe("articleRepository ownership", () => {
  // Every export of a "use server" module is an endpoint a client can call
  // with any argument, so an article id alone must never be enough to change
  // someone else's article.
  it.each([
    ["markArticleAsRead", markArticleAsRead],
    ["markArticleAsReadLater", markArticleAsReadLater],
    ["markArticleAsNotInteresting", markArticleAsNotInteresting],
    ["restoreArticleToInbox", restoreArticleToInbox],
    ["unmarkArticleAsReadLater", unmarkArticleAsReadLater],
    ["markArticleAsStarred", markArticleAsStarred],
    ["unmarkArticleAsStarred", unmarkArticleAsStarred],
    ["restoreArticleStatus", (id: number) => restoreArticleStatus(id, "READ")],
  ])("%s refuses an article that belongs to someone else", async (_, act) => {
    const other = await createUser();
    const otherFeed = await createFeed({ userId: other.id });
    const theirs = await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      status: "READ_LATER",
      starred: true,
    });

    await expect(act(theirs.id)).rejects.toThrow();

    const untouched = await prisma.article.findUniqueOrThrow({
      where: { id: theirs.id },
    });
    expect(untouched.status).toBe("READ_LATER");
    expect(untouched.starred).toBe(true);
    expect(untouched.statusChangedAt.getTime()).toBe(
      theirs.statusChangedAt.getTime(),
    );
  });

  it("markArticlesOlderThanXDaysAsRead leaves someone else's feed alone", async () => {
    const other = await createUser();
    const otherFeed = await createFeed({ userId: other.id });
    const theirs = await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      publicationDate: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(await markArticlesOlderThanXDaysAsRead(otherFeed.id, 1)).toBe(0);

    const untouched = await prisma.article.findUniqueOrThrow({
      where: { id: theirs.id },
    });
    expect(untouched.status).toBe("UNREAD");
  });
});
