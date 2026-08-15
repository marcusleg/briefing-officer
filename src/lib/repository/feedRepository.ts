"use server";

import {
  Article,
  Feed,
  FeedFilterKind,
  Prisma,
} from "@/generated/prisma/client";
import { generateAiLead } from "@/lib/ai/services/leadService";
import { DEFAULT_DISINTERESTS, dedupeKeywords } from "@/lib/feedFilters";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { CategorySchema, FeedSchema } from "@/lib/repository/feedSchema";
import { getUserId } from "@/lib/repository/userRepository";
import { scrapeArticle, scrapeFeed } from "@/lib/scraper";
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

  // Seeded only on create. An update that arrives with an empty disinterest
  // list means the reader removed the defaults, and re-adding them here would
  // make them unremovable.
  await prisma.feedFilter.createMany({
    data: filterRows(createdFeed.id, feed.interests, [
      ...feed.disinterests,
      ...DEFAULT_DISINTERESTS,
    ]),
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

const processArticle = async (article: Article) => {
  try {
    await scrapeArticle(article.id, article.link);
  } catch (error) {
    logger.error(
      {
        err: error,
        article: { id: article.id, title: article.title, link: article.link },
      },
      "Failed to scrape article.",
    );
  }

  try {
    await generateAiLead(article.id);
  } catch (error) {
    logger.error(
      {
        err: error,
        article: { id: article.id, title: article.title, link: article.link },
      },
      "Failed to generate AI lead.",
    );
  }

  revalidatePath(`/feed/${article.feedId}`);
};

export const refreshFeed = async (feedId: number) => {
  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });

  logger.debug({ feedId, feedTitle: feed.title }, "Refreshing feed.");

  const feedItems = await scrapeFeed(feed);

  const existingLinks = new Set(
    (
      await prisma.article.findMany({
        where: { feedId: feed.id, userId: feed.userId },
        select: { link: true },
      })
    ).map((a) => a.link),
  );

  const createArticlePromises = feedItems.map((item) =>
    prisma.article.upsert({
      where: {
        userId_feedId_link: {
          userId: feed.userId,
          feedId: feed.id,
          link: item.link,
        },
      },
      create: {
        ...item,
        feedId: feed.id,
        userId: feed.userId,
      },
      update: {
        commentsLink: item.commentsLink,
        author: item.author,
      },
    }),
  );

  const createArticleResults = await Promise.allSettled(createArticlePromises);
  // TODO check whether articles that already exist have changed
  const createdArticles = createArticleResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((article) => !existingLinks.has(article.link));

  const processedArticles = createdArticles.map((article) =>
    processArticle(article),
  );
  await Promise.allSettled(processedArticles);

  await updateLastFetchedToNow(feed);

  revalidatePath(`/feed/${feedId}`);

  logger.info(
    {
      feed: { id: feed.id, title: feed.title, link: feed.link },
      numberOfNewArticles: createdArticles.length,
    },
    "Feed refreshed. Processing new articles in the background.",
  );
};

export const refreshCategoryFeeds = async (categoryId: number) => {
  const feeds = await prisma.feed.findMany({
    where: { feedCategoryId: categoryId, autoRefresh: true },
    select: { id: true },
  });

  const promises = feeds.map(async (feed) => {
    await refreshFeed(feed.id);
    revalidatePath(`/feed/${feed.id}`);
  });
  const results = await Promise.allSettled(promises);

  revalidatePath("/feed");
  revalidatePath(`/feed/category/${categoryId}`);

  if (results.filter((result) => result.status === "rejected").length > 0) {
    throw new Error("Failed to refresh one or more feeds.");
  }
};

export const refreshFeeds = async () => {
  logger.debug("Refreshing all feeds.");

  const feeds = await prisma.feed.findMany({
    where: { autoRefresh: true },
    select: { id: true },
  });

  const promises = feeds.map(async (feed) => {
    await refreshFeed(feed.id);
    revalidatePath(`/feed/${feed.id}`);
  });
  const results = await Promise.allSettled(promises);

  revalidatePath("/feed");

  if (results.filter((result) => result.status === "rejected").length > 0) {
    throw new Error("Failed to refresh one or more feeds.");
  }
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

const updateLastFetchedToNow = async (feed: Feed) => {
  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });
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
    interests: textsOfKind("INTEREST"),
    disinterests: textsOfKind("DISINTEREST"),
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

  revalidatePath("/feed", "layout");
};

export const removeFeedFilter = async (
  feedId: number,
  kind: FeedFilterKind,
  text: string,
) => {
  await prisma.feedFilter.deleteMany({ where: { feedId, kind, text } });

  revalidatePath("/feed", "layout");
};
