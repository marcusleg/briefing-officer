import prisma from "@/lib/prismaClient";
import {
  markArticleAsRead,
  markArticleAsReadLater,
  markArticleAsStarred,
  unmarkArticleAsStarred,
} from "@/lib/repository/articleRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
import { getUserId } from "@/lib/repository/userRepository";

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
  it("marks an article as read and clears readLater", async () => {
    const article = await createArticle({ userId, feedId, readLater: true });

    await markArticleAsRead(article.id);

    const updated = await prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(updated.readAt).not.toBeNull();
    expect(updated.readLater).toBe(false);
  });

  it("marks an article as read later", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsReadLater(article.id);

    const updated = await prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(updated.readLater).toBe(true);
  });

  it("stars and unstars an article", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsStarred(article.id);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).starred).toBe(true);

    await unmarkArticleAsStarred(article.id);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).starred).toBe(false);
  });

  it("enforces the unique (userId, feedId, link) constraint", async () => {
    await createArticle({ userId, feedId, link: "https://example.com/dup" });
    await expect(
      createArticle({ userId, feedId, link: "https://example.com/dup" }),
    ).rejects.toThrow();
  });
});
