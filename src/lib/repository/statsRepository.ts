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

const getLast7Days = () => {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const from = new Date(today);
    from.setDate(today.getDate() - 6 + i - 1);
    const fromFormatted = from.toISOString().split("T")[0];

    const to = new Date(today);
    to.setDate(today.getDate() - 6 + i);
    const toFormatted = to.toISOString().split("T")[0];

    dates.push({ from: fromFormatted, to: toFormatted });
  }

  return dates;
};

export const getWeeklyArticleCountPerFeed = async () => {
  const userId = await getUserId();

  const last7Days = getLast7Days();

  const numberOfArticlesLast7Days = await Promise.all(
    last7Days.map((dateRange) =>
      prisma.article.aggregate({
        _count: {
          _all: true,
        },
        where: {
          publicationDate: {
            gte: new Date(dateRange.from),
            lt: new Date(dateRange.to),
          },
          userId,
        },
      }),
    ),
  );
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return last7Days.map((dateRange, index) => ({
    date: dateRange.from.split("T")[0],
    weekday: weekDays[new Date(dateRange.to).getDay()],
    count: numberOfArticlesLast7Days[index]._count._all,
  }));
};

export const getWeeklyArticlesRead = async () => {
  const userId = await getUserId();

  const last7Days = getLast7Days();

  const numberOfArticlesReadLast7Days = await Promise.all(
    last7Days.map((dateRange) =>
      prisma.article.aggregate({
        _count: {
          _all: true,
        },
        where: {
          readAt: {
            gte: new Date(dateRange.from),
            lt: new Date(dateRange.to),
          },
          userId,
        },
      }),
    ),
  );
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return last7Days.map((dateRange, index) => ({
    date: dateRange.from.split("T")[0],
    weekday: weekDays[new Date(dateRange.to).getDay()],
    count: numberOfArticlesReadLast7Days[index]._count._all,
  }));
};
