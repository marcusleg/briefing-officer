import prisma from "@/lib/prismaClient";
import {
  archiveArticle,
  dismissArticle,
  dismissArticlesOlderThanXDays,
  markArticleAsNotInteresting,
  markArticleAsReadLater,
  restoreArticleStatus,
  restoreArticleToInbox,
  unarchiveArticle,
  unmarkArticleAsReadLater,
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
  it("dismisses an article", async () => {
    const article = await createArticle({
      userId,
      feedId,
      status: "READ_LATER",
    });

    await dismissArticle(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("DISMISSED");
  });

  it("marks an article as read later", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsReadLater(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("READ_LATER");
  });

  it.each(["DISMISSED", "FILTERED"] as const)(
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

    await dismissArticle(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.statusChangedAt.getTime()).toBeGreaterThan(
      longAgo.getTime(),
    );
  });

  it("archives and unarchives an article", async () => {
    const article = await createArticle({ userId, feedId });

    await archiveArticle(article.id);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: article.id } }))
        .archived,
    ).toBe(true);

    await unarchiveArticle(article.id);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: article.id } }))
        .archived,
    ).toBe(false);
  });

  it("enforces the unique (userId, feedId, link) constraint", async () => {
    await createArticle({ userId, feedId, link: "https://example.com/dup" });
    await expect(
      createArticle({ userId, feedId, link: "https://example.com/dup" }),
    ).rejects.toThrow();
  });

  it("orders dismissed articles most recently dismissed first", async () => {
    const oldest = await createArticle({
      userId,
      feedId,
      status: "DISMISSED",
      statusChangedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newest = await createArticle({
      userId,
      feedId,
      status: "DISMISSED",
      statusChangedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const middle = await createArticle({
      userId,
      feedId,
      status: "DISMISSED",
      statusChangedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    await createArticle({ userId, feedId, status: "UNREAD" });
    await createArticle({ userId, feedId, status: "READ_LATER" });

    const history = await prisma.article.findMany({
      where: { status: "DISMISSED", userId },
      orderBy: { statusChangedAt: "desc" },
    });

    expect(history.map((a) => a.id)).toEqual([newest.id, middle.id, oldest.id]);
  });

  it("does not move statusChangedAt when only archived changes", async () => {
    const dismissedAtTime = new Date("2026-01-01T00:00:00.000Z");
    const article = await createArticle({
      userId,
      feedId,
      status: "DISMISSED",
      statusChangedAt: dismissedAtTime,
    });

    await archiveArticle(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.statusChangedAt.getTime()).toBe(dismissedAtTime.getTime());
  });
});

describe("articleRepository ownership", () => {
  // Every export of a "use server" module is an endpoint a client can call
  // with any argument, so an article id alone must never be enough to change
  // someone else's article.
  it.each([
    ["dismissArticle", dismissArticle],
    ["markArticleAsReadLater", markArticleAsReadLater],
    ["markArticleAsNotInteresting", markArticleAsNotInteresting],
    ["restoreArticleToInbox", restoreArticleToInbox],
    ["unmarkArticleAsReadLater", unmarkArticleAsReadLater],
    ["archiveArticle", archiveArticle],
    ["unarchiveArticle", unarchiveArticle],
    [
      "restoreArticleStatus",
      (id: number) => restoreArticleStatus(id, "DISMISSED"),
    ],
  ])("%s refuses an article that belongs to someone else", async (_, act) => {
    const other = await createUser();
    const otherFeed = await createFeed({ userId: other.id });
    const theirs = await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      status: "READ_LATER",
      archived: true,
    });

    await expect(act(theirs.id)).rejects.toThrow();

    const untouched = await prisma.article.findUniqueOrThrow({
      where: { id: theirs.id },
    });
    expect(untouched.status).toBe("READ_LATER");
    expect(untouched.archived).toBe(true);
    expect(untouched.statusChangedAt.getTime()).toBe(
      theirs.statusChangedAt.getTime(),
    );
  });

  it("dismissArticlesOlderThanXDays leaves someone else's feed alone", async () => {
    const other = await createUser();
    const otherFeed = await createFeed({ userId: other.id });
    const theirs = await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      publicationDate: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(await dismissArticlesOlderThanXDays(otherFeed.id, 1)).toBe(0);

    const untouched = await prisma.article.findUniqueOrThrow({
      where: { id: theirs.id },
    });
    expect(untouched.status).toBe("UNREAD");
  });
});
