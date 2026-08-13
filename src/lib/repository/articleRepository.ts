"use server";

import { ArticleStatus, Prisma } from "@/generated/prisma/client";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { revalidatePath } from "next/cache";

/**
 * Temporary. `readAt` and `readLater` are still what the application reads
 * until Task 2, so every status write mirrors into them. Deleted in Task 2 once
 * nothing reads them.
 */
const legacyMirror = (status: ArticleStatus) => ({
  readAt: status === "READ" ? new Date() : null,
  readLater: status === "READ_LATER",
});

/**
 * The only writers of `status` and `statusChangedAt`. Pairing the two writes
 * here is what lets History treat `statusChangedAt` as the read timestamp: for
 * a READ article it is, by construction, the moment it became read. Anything
 * that writes one without the other breaks that.
 */
const setArticleStatus = (articleId: number, status: ArticleStatus) =>
  prisma.article.update({
    where: { id: articleId },
    data: { status, statusChangedAt: new Date(), ...legacyMirror(status) },
  });

const setArticleStatusMany = (
  where: Prisma.ArticleWhereInput,
  status: ArticleStatus,
) =>
  prisma.article.updateMany({
    where,
    data: { status, statusChangedAt: new Date(), ...legacyMirror(status) },
  });

export const markArticleAsRead = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "READ");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const markArticleAsReadLater = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "READ_LATER");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/read-later");
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const markArticleAsStarred = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      starred: true,
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/starred-articles");
  revalidatePath("/feed");
};

export const deleteArticlesOlderThanXDays = async (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const result = await prisma.article.deleteMany({
    where: {
      publicationDate: { lte: date },
      readLater: false,
      starred: false,
    },
  });

  if (result.count > 0) {
    logger.info(
      { count: result.count, days },
      "Deleted articles older than X days.",
    );
    revalidatePath("/feed/*");
    revalidatePath("/feed");
    revalidatePath("/feed", "layout");
  }
};

export const markArticlesOlderThanXDaysAsRead = async (
  feedId: number,
  days: number,
) => {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const { count } = await setArticleStatusMany(
    {
      feedId: feedId,
      publicationDate: { lte: date },
      readAt: null,
      readLater: false,
    },
    "READ",
  );

  revalidatePath(`/feed/${feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");

  return count;
};

export const markCategoryArticlesOlderThanXDaysAsRead = async (
  categoryId: number,
  days: number,
) => {
  const userId = await getUserId();

  const date = new Date();
  date.setDate(date.getDate() - days);

  const { count } = await setArticleStatusMany(
    {
      publicationDate: { lte: date },
      readAt: null,
      readLater: false,
      userId,
      feed: { is: { feedCategoryId: categoryId } },
    },
    "READ",
  );

  revalidatePath(`/feed/category/${categoryId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");

  return count;
};

export const unmarkArticleAsRead = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "UNREAD");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const unmarkArticleAsReadLater = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "UNREAD");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/read-later");
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const unmarkArticleAsStarred = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      starred: false,
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/starred-articles");
  revalidatePath("/feed");
};
