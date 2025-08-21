"use server";

import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

export const getNumberOfReadLaterArticles = async () => {
  const userId = await getUserId();
  return prisma.article.count({
    where: {
      readLater: true,
      userId,
    },
  });
};

export const getNumberOfUnreadArticles = async () => {
  const userId = await getUserId();
  return prisma.article.count({
    where: {
      readAt: null,
      readLater: false,
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
          articles: { where: { readAt: null } },
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

export const getWeeklyArticleCountPerFeed = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  // Fetch feeds once to map feedId -> title
  const feeds = await prisma.feed.findMany({
    where: { userId },
    select: { id: true, title: true },
  });
  const feedTitleById = new Map(feeds.map((f) => [f.id, f.title]));

  // For each date, group articles by feed and count
  const perDayPerFeed = await Promise.all(
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

      const entry: Record<string, string> = { date };
      groups.forEach((g: any) => {
        const title = feedTitleById.get(g.feedId);
        if (title) {
          entry[title] = g._count._all;
        }
      });
      return entry;
    }),
  );

  return perDayPerFeed;
};

export const getWeeklyArticlesRead = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  const articlesReadPerDay = await Promise.all(
    dates.map((date) =>
      prisma.article.aggregate({
        _count: {
          _all: true,
        },
        where: {
          readAt: {
            gte: `${date}T00:00:00.000Z`,
            lte: `${date}T23:59:59.999Z`,
          },
          userId,
        },
      }),
    ),
  );

  return dates.map((date, index) => ({
    date,
    count: articlesReadPerDay[index]._count._all,
  }));
};

export const getTokenUsageHistory = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  return prisma.tokenUsage.findMany({
    where: {
      userId,
      date: {
        in: dates,
      },
    },
  });
};
