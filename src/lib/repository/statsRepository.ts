"use server";

import prisma from "@/lib/prismaClient";
import {
  ArticlesPerFeedRow,
  shapeArticlesPerFeedPerDay,
  shapeStatusChangesPerFeedPerDay,
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

const getFeedTitleById = async (userId: string) => {
  const feeds = await prisma.feed.findMany({
    where: { userId },
    select: { id: true, title: true },
  });

  return new Map(feeds.map((feed) => [feed.id, feed.title]));
};

export const getWeeklyArticleCountPerFeed = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  const feedTitleById = await getFeedTitleById(userId);

  const perDayPerFeed: ArticlesPerFeedRow[] = await Promise.all(
    dates.map(async (date) => {
      const groups = await prisma.article.groupBy({
        by: ["feedId"],
        _count: { _all: true },
        where: {
          publicationDate: {
            gte: `${date}T00:00:00.000Z`,
            lte: `${date}T23:59:59.999Z`,
          },
          userId,
        },
      });

      const entry: ArticlesPerFeedRow = { date };
      groups.forEach((g) => {
        const title = feedTitleById.get(g.feedId);
        if (title) {
          entry[title] = g._count._all;
        }
      });
      return entry;
    }),
  );

  return shapeArticlesPerFeedPerDay(perDayPerFeed);
};

/**
 * Articles the reader marked read, per day and per feed, so the chart can stack
 * the day's total by where the articles came from.
 */
export const getWeeklyArticlesRead = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);
  const feedTitleById = await getFeedTitleById(userId);

  const readArticles = await prisma.article.findMany({
    select: { feedId: true, statusChangedAt: true },
    where: {
      status: "READ",
      statusChangedAt: {
        gte: `${dates[0]}T00:00:00.000Z`,
        lte: `${dates[dates.length - 1]}T23:59:59.999Z`,
      },
      userId,
    },
  });

  return shapeStatusChangesPerFeedPerDay(dates, readArticles, feedTitleById);
};

/**
 * Articles that never made it to the reader, per day and per feed — whether the
 * model filtered them against the feed's keywords or the reader rejected them
 * by hand. This matches what the Filtered view lists.
 */
export const getFilteredArticlesPerDay = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);
  const feedTitleById = await getFeedTitleById(userId);

  const rejectedArticles = await prisma.article.findMany({
    select: { feedId: true, statusChangedAt: true },
    where: {
      status: "FILTERED",
      statusChangedAt: {
        gte: `${dates[0]}T00:00:00.000Z`,
        lte: `${dates[dates.length - 1]}T23:59:59.999Z`,
      },
      userId,
    },
  });

  return shapeStatusChangesPerFeedPerDay(
    dates,
    rejectedArticles,
    feedTitleById,
  );
};

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
