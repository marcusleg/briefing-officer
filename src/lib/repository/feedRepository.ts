"use server";

import { FeedFilterKind, Prisma } from "@/generated/prisma/client";
import { dedupeKeywords, sortKeywords } from "@/lib/feedFilters";
import { enqueue, enqueueMany } from "@/lib/jobs/jobRepository";
import { wakeWorker } from "@/lib/jobs/worker";
import prisma from "@/lib/prismaClient";
import { CategorySchema, FeedSchema } from "@/lib/repository/feedSchema";
import { getUserId } from "@/lib/repository/userRepository";
import { parseFeed } from "htmlparser2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Deduplicated in JavaScript rather than with `createMany({ skipDuplicates })`,
 * which Prisma's SQLite connector does not support. The database's unique
 * constraint remains the backstop.
 */
const filterRows = (
  feedId: number,
  interests: string[],
  disinterests: string[],
) => [
  ...dedupeKeywords(interests).map((text) => ({
    feedId,
    kind: "INTEREST" as FeedFilterKind,
    text,
  })),
  ...dedupeKeywords(disinterests).map((text) => ({
    feedId,
    kind: "DISINTEREST" as FeedFilterKind,
    text,
  })),
];

export const createFeed = async (feed: FeedSchema) => {
  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);

  if (!parsedFeed || !parsedFeed.title) {
    throw new Error("Invalid feed");
  }

  const userId = await getUserId();

  const createdFeed = await prisma.feed.create({
    data: {
      title: feed.title || parsedFeed.title,
      link: feed.link,
      autoRefresh: feed.autoRefresh,
      feedCategoryId: feed.feedCategoryId ?? null,
      lastFetched: new Date(0),
      userId: userId,
    },
  });

  // DEFAULT_DISINTERESTS is no longer merged in here: the form prefills them
  // into feed.disinterests so the reader can delete one before the feed
  // exists. Merging them here too would put a removed default right back.
  await prisma.feedFilter.createMany({
    data: filterRows(createdFeed.id, feed.interests, feed.disinterests),
  });

  revalidatePath("/feed", "layout");

  await refreshFeed(createdFeed.id);
};

export const deleteFeed = async (feedId: number) => {
  const userId = await getUserId();

  await prisma.article.deleteMany({ where: { feedId: feedId, userId } });
  await prisma.feed.delete({ where: { id: feedId, userId } });

  revalidatePath("/feed", "layout");
  redirect("/");
};

/**
 * Queues a fetch of one feed. The reader asked, so `autoRefresh` does not
 * matter here. The worker picks the job up within milliseconds; open pages
 * learn about new articles over the event stream.
 */
export const refreshFeed = async (feedId: number) => {
  const userId = await getUserId();
  const feed = await prisma.feed.findFirst({
    where: { id: feedId, userId },
    select: { id: true },
  });
  if (!feed) {
    throw new Error("Feed not found");
  }

  await enqueue("REFRESH_FEED", feed.id);
  wakeWorker();
};

const queueRefreshes = async (where: Prisma.FeedWhereInput) => {
  const feeds = await prisma.feed.findMany({
    where: { ...where, autoRefresh: true },
    select: { id: true },
  });

  await enqueueMany(
    "REFRESH_FEED",
    feeds.map((feed) => feed.id),
  );
  wakeWorker();
};

export const refreshCategoryFeeds = async (categoryId: number) => {
  const userId = await getUserId();
  await queueRefreshes({ userId, feedCategoryId: categoryId });
};

export const refreshFeeds = async () => {
  const userId = await getUserId();
  await queueRefreshes({ userId });
};

export const updateFeed = async (feedId: number, feed: FeedSchema) => {
  const userId = await getUserId();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.feed.update({
      where: { id: feedId, userId },
      data: {
        title: feed.title,
        link: feed.link,
        autoRefresh: feed.autoRefresh,
        feedCategoryId: feed.feedCategoryId ?? null,
      },
    });

    await tx.feedFilter.deleteMany({ where: { feedId } });
    await tx.feedFilter.createMany({
      data: filterRows(feedId, feed.interests, feed.disinterests),
    });
  });

  revalidatePath("/feed", "layout");

  await refreshFeed(feedId);
};

export const getUserCategories = async () => {
  const userId = await getUserId();

  return prisma.feedCategory.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
};

export const createCategory = async (category: CategorySchema) => {
  const userId = await getUserId();

  await prisma.feedCategory.create({
    data: {
      ...category,
      userId: userId,
    },
  });

  revalidatePath("/feed", "layout");
};

export const updateCategory = async (
  categoryId: number,
  category: CategorySchema,
) => {
  await prisma.feedCategory.update({
    where: { id: categoryId },
    data: {
      ...category,
    },
  });

  revalidatePath("/feed", "layout");
};

export const deleteCategory = async (categoryId: number) => {
  // First, update all feeds in this category to have no category
  await prisma.feed.updateMany({
    where: { feedCategoryId: categoryId },
    data: { feedCategoryId: null },
  });

  // Then delete the category
  await prisma.feedCategory.delete({
    where: { id: categoryId },
  });

  revalidatePath("/feed", "layout");
};

export const getFeedFilters = async (feedId: number) => {
  const filters = await prisma.feedFilter.findMany({
    where: { feedId },
    orderBy: { createdAt: "asc" },
  });

  const textsOfKind = (kind: FeedFilterKind) =>
    filters.filter((filter) => filter.kind === kind).map((f) => f.text);

  return {
    interests: sortKeywords(textsOfKind("INTEREST")),
    disinterests: sortKeywords(textsOfKind("DISINTEREST")),
  };
};

/**
 * Idempotent by way of `upsert` rather than
 * `createMany({ skipDuplicates: true })`, which Prisma's SQLite connector does
 * not support. Adding an entry that is already present is something the reader
 * meant, not an error to report.
 *
 * The upsert's `where` only catches an exact-text match; SQLite's unique
 * index is case-sensitive, and Prisma's SQLite connector does not support
 * `mode: "insensitive"`. So a case-insensitive match against this feed's
 * existing rows of the same kind is checked in JavaScript first — matching
 * how `dedupeKeywords` in feedFilters.ts already treats "Politics" and
 * "politics" as the same entry elsewhere in this feature.
 */
export const addFeedFilter = async (
  feedId: number,
  kind: FeedFilterKind,
  text: string,
) => {
  const existing = await prisma.feedFilter.findMany({
    where: { feedId, kind },
    select: { text: true },
  });

  if (
    existing.some((filter) => filter.text.toLowerCase() === text.toLowerCase())
  ) {
    return;
  }

  await prisma.feedFilter.upsert({
    where: { feedId_kind_text: { feedId, kind, text } },
    create: { feedId, kind, text },
    update: {},
  });

  // Deliberately does not revalidate: the only caller keeps a popover open
  // over the article that triggered this filter, so the reader can add more
  // keywords or use Undo. Revalidating here would refresh the inbox list out
  // from under it — the article drops out of the UNREAD query, its
  // ArticleCard unmounts, and the popover vanishes mid-interaction. The
  // caller revalidates itself once the popover closes instead.
};

export const removeFeedFilter = async (
  feedId: number,
  kind: FeedFilterKind,
  text: string,
) => {
  await prisma.feedFilter.deleteMany({ where: { feedId, kind, text } });

  // Deliberately does not revalidate — same reasoning as addFeedFilter above:
  // the only caller keeps a popover open over the affected article, and
  // revalidating would unmount it mid-interaction.
};
