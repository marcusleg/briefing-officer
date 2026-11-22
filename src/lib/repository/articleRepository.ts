"use server";

import { ArticleStatus } from "@/generated/prisma/client";
import { READER_FILTER_REASON } from "@/lib/article";
import {
  setArticleStatusForUser,
  setArticleStatusManyForUser,
} from "@/lib/articleStatus";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { revalidatePath } from "next/cache";

/**
 * Scoped to the signed-in reader: every export of this module is a server
 * action a client can call with any article id, so the id alone must never be
 * enough. Status writes go through `@/lib/articleStatus` with the session's
 * user id; an article that is not theirs fails just like a missing one.
 */
const setArticleStatus = async (
  articleId: number,
  status: ArticleStatus,
  filterReason?: string,
) =>
  setArticleStatusForUser(await getUserId(), articleId, status, filterReason);

/** Scoped like `setArticleStatus`; archiving leaves `statusChangedAt` be. */
const setArticleArchived = async (articleId: number, archived: boolean) =>
  prisma.article.update({
    where: { id: articleId, userId: await getUserId() },
    data: { archived },
  });

export const dismissArticle = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "DISMISSED");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const markArticleAsReadLater = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "READ_LATER");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed/read-later");
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const archiveArticle = async (articleId: number) => {
  const updatedArticle = await setArticleArchived(articleId, true);

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed/archived");
  revalidatePath("/feed");
};

export const dismissArticlesOlderThanXDays = async (
  feedId: number,
  days: number,
) => {
  const userId = await getUserId();

  const date = new Date();
  date.setDate(date.getDate() - days);

  const { count } = await setArticleStatusManyForUser(
    userId,
    {
      feedId: feedId,
      publicationDate: { lte: date },
      status: "UNREAD",
    },
    "DISMISSED",
  );

  revalidatePath(`/feed/${feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");

  return count;
};

export const dismissCategoryArticlesOlderThanXDays = async (
  categoryId: number,
  days: number,
) => {
  const userId = await getUserId();

  const date = new Date();
  date.setDate(date.getDate() - days);

  const { count } = await setArticleStatusManyForUser(
    userId,
    {
      publicationDate: { lte: date },
      status: "UNREAD",
      feed: { is: { feedCategoryId: categoryId } },
    },
    "DISMISSED",
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

// Deliberately does not revalidate. Its only caller (NotInterestedButton)
// keeps a popover open over the article this just dismissed, so that the
// reader can teach the feed's filter; revalidating here would refresh the
// inbox list out from under it — the article drops out of the UNREAD query,
// its ArticleCard unmounts, and the popover vanishes before the reader can
// use it. The caller revalidates itself once the popover closes instead.
export const markArticleAsNotInteresting = async (articleId: number) => {
  await setArticleStatus(articleId, "FILTERED", READER_FILTER_REASON);
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
  revalidatePath("/feed/read-later");
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

export const unarchiveArticle = async (articleId: number) => {
  const updatedArticle = await setArticleArchived(articleId, false);

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed/archived");
  revalidatePath("/feed");
};
