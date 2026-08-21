"use server";

import { ArticleStatus } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";
import {
  ArticlesPerFeedData,
  shapeArticlesPerFeedPerDay,
  shapeTokenUsage,
} from "@/lib/repository/statsTransforms";
import { getUserId } from "@/lib/repository/userRepository";

export const getNumberOfReadLaterArticles = async () => {
  const userId = await getUserId();
  return prisma.article.count({
    where: {
      status: "READ_LATER",
      userId,
    },
  });
};

export const getNumberOfUnreadArticles = async () => {
  const userId = await getUserId();
  return prisma.article.count({
    where: {
      status: "UNREAD",
      userId,
    },
  });
};

export const getUnreadArticlesPerFeed = async () => {
  const userId = await getUserId();
  const feedWithUnreadArticleCount = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { status: "UNREAD" } },
        },
      },
    },
    where: { userId },
  });

  return feedWithUnreadArticleCount.map((feed) => {
    return {
      feedTitle: feed.title,
      unread: feed._count.articles,
    };
  });
};

const getDaysInDateRange = (from: Date, to: Date) => {
  if (from > to) {
    throw new Error("'from' date must be before or equal to 'to' date");
  }

  const dates: string[] = [];
  const current = new Date(from);

  while (current <= to) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

/**
 * The UTC span covering every day in `dates`, as a Prisma date filter. Callers
 * must rule out an empty `dates` first — there is no span to build then.
 */
const utcRangeOf = (dates: string[]) => ({
  gte: `${dates[0]}T00:00:00.000Z`,
  lte: `${dates[dates.length - 1]}T23:59:59.999Z`,
});

/**
 * What the daily-per-feed charts render for a range that covers no days, which
 * `getDaysInDateRange` returns for an unparseable `from` or `to`.
 */
const noArticlesPerFeed = (): ArticlesPerFeedData => ({
  rows: [],
  feedKeys: [],
  dailyAverage: 0,
});

const getFeedTitleById = async (userId: string) => {
  const feeds = await prisma.feed.findMany({
    where: { userId },
    select: { id: true, title: true },
  });

  return new Map(feeds.map((feed) => [feed.id, feed.title]));
};

/**
 * New articles per day and per feed, filed under the day they were published.
 */
export const getWeeklyArticleCountPerFeed = async (from: Date, to: Date) => {
  const userId = await getUserId();
  const dates = getDaysInDateRange(from, to);

  if (dates.length === 0) return noArticlesPerFeed();

  const [feedTitleById, articles] = await Promise.all([
    getFeedTitleById(userId),
    prisma.article.findMany({
      select: { feedId: true, publicationDate: true },
      where: { publicationDate: utcRangeOf(dates), userId },
    }),
  ]);

  return shapeArticlesPerFeedPerDay(
    dates,
    articles.map(({ feedId, publicationDate }) => ({
      feedId,
      at: publicationDate,
    })),
    feedTitleById,
  );
};

/**
 * Articles that reached a terminal status per day and per feed, filed under the
 * day they got there, so the chart can stack the day's total by feed.
 */
const getStatusChangesPerFeedPerDay = async (
  status: ArticleStatus,
  from: Date,
  to: Date,
) => {
  const userId = await getUserId();
  const dates = getDaysInDateRange(from, to);

  if (dates.length === 0) return noArticlesPerFeed();

  const [feedTitleById, articles] = await Promise.all([
    getFeedTitleById(userId),
    prisma.article.findMany({
      select: { feedId: true, statusChangedAt: true },
      where: { status, statusChangedAt: utcRangeOf(dates), userId },
    }),
  ]);

  return shapeArticlesPerFeedPerDay(
    dates,
    articles.map(({ feedId, statusChangedAt }) => ({
      feedId,
      at: statusChangedAt,
    })),
    feedTitleById,
  );
};

/** Articles the reader marked read. */
export const getWeeklyArticlesRead = async (from: Date, to: Date) =>
  getStatusChangesPerFeedPerDay("READ", from, to);

/**
 * Articles that never made it to the reader — whether the model filtered them
 * against the feed's keywords or the reader rejected them by hand. This matches
 * what the Filtered view lists.
 */
export const getFilteredArticlesPerDay = async (from: Date, to: Date) =>
  getStatusChangesPerFeedPerDay("FILTERED", from, to);

export const getTokenUsageHistory = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  const raw = await prisma.tokenUsage.findMany({
    where: {
      userId,
      date: {
        in: dates,
      },
    },
  });

  const { rows, models } = shapeTokenUsage(raw);
  return { rows, models };
};
