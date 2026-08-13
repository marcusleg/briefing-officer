import prisma from "@/lib/prismaClient";
import {
  markArticleAsRead,
  markArticleAsReadLater,
  markArticleAsStarred,
  unmarkArticleAsRead,
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
    expect(updated.readAt).not.toBeNull();
    expect(updated.readLater).toBe(false);
  });

  it("marks an article as read later", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsReadLater(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("READ_LATER");
    expect(updated.readLater).toBe(true);
  });

  it("returns an article to the inbox", async () => {
    const article = await createArticle({ userId, feedId, status: "READ" });

    await unmarkArticleAsRead(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("UNREAD");
    expect(updated.readAt).toBeNull();
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
});
