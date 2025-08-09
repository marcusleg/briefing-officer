"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { revalidatePath } from "next/cache";

export const markArticleAsRead = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      readAt: new Date(),
      readLater: false,
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const markArticleAsReadLater = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      readLater: true,
    },
  });

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

  const { count } = await prisma.article.updateMany({
    where: { feedId: feedId, publicationDate: { lte: date }, readAt: null },
    data: { readAt: new Date() },
  });

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

  const { count } = await prisma.article.updateMany({
    where: {
      publicationDate: { lte: date },
      readAt: null,
      userId,
      feed: { is: { feedCategoryId: categoryId } },
    },
    data: { readAt: new Date() },
  });

  revalidatePath(`/feed/category/${categoryId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");

  return count;
};

export const unmarkArticleAsRead = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      readAt: null,
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const unmarkArticleAsReadLater = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      readLater: false,
    },
  });

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
