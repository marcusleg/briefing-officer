import prisma from "@/lib/prismaClient";
import {
  markArticleAsNotInteresting,
  markArticleAsRead,
  markArticleAsReadLater,
  markArticleAsStarred,
  restoreArticleToInbox,
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
