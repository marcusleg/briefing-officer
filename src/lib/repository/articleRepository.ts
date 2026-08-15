"use server";

import { ArticleStatus, Prisma } from "@/generated/prisma/client";
import { READER_FILTER_REASON } from "@/lib/article";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { revalidatePath } from "next/cache";

/**
 * The only writers of `status` and `statusChangedAt`. Pairing the two writes
 * here is what lets History treat `statusChangedAt` as the read timestamp: for
 * a READ article it is, by construction, the moment it became read. Anything
 * that writes one without the other breaks that.
 *
 * `filterReason` is optional and only ever set alongside `FILTERED`. It is
 * accepted here rather than written separately so a rejection cannot land as a
 * status without its explanation.
 */
const setArticleStatus = (
  articleId: number,
  status: ArticleStatus,
  filterReason?: string,
) =>
  prisma.article.update({
    where: { id: articleId },
    data: {
      status,
      statusChangedAt: new Date(),
      ...(filterReason === undefined ? {} : { filterReason }),
    },
  });

const setArticleStatusMany = (
  where: Prisma.ArticleWhereInput,
  status: ArticleStatus,
) =>
  prisma.article.updateMany({
    where,
    data: { status, statusChangedAt: new Date() },
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
      status: { not: "READ_LATER" },
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
      status: "UNREAD",
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
      status: "UNREAD",
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

export const restoreArticleToInbox = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "UNREAD");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const markArticleAsNotInteresting = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(
    articleId,
    "FILTERED",
    READER_FILTER_REASON,
  );

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

/**
 * Undo target. Takes the status the article held before the action being
 * undone, rather than assuming that action's inverse.
 */
export const restoreArticleStatus = async (
  articleId: number,
  status: ArticleStatus,
) => {
  const updatedArticle = await setArticleStatus(articleId, status);

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
