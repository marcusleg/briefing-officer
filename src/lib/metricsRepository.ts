"use server";

import { type GaugeMetrics } from "@/lib/metricsFormatter";
import prisma from "@/lib/prismaClient";

export const collectGaugeMetrics = async (): Promise<GaugeMetrics> => {
  const [
    usersTotal,
    feeds,
    feedRows,
    totalByFeed,
    unreadByFeed,
    readLaterByFeed,
    starredByFeed,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.feed.groupBy({
      by: ["userId"],
      _count: {
        _all: true,
      },
      orderBy: {
        userId: "asc",
      },
    }),
    prisma.feed.findMany({
      select: {
        id: true,
        title: true,
        userId: true,
      },
      orderBy: [{ userId: "asc" }, { title: "asc" }, { id: "asc" }],
    }),
    prisma.article.groupBy({
      by: ["feedId"],
      _count: {
        _all: true,
      },
    }),
    prisma.article.groupBy({
      by: ["feedId"],
      _count: {
        _all: true,
      },
      where: {
        readAt: null,
      },
    }),
    prisma.article.groupBy({
      by: ["feedId"],
      _count: {
        _all: true,
      },
      where: {
        readLater: true,
      },
    }),
    prisma.article.groupBy({
      by: ["feedId"],
      _count: {
        _all: true,
      },
      where: {
        starred: true,
      },
    }),
  ]);

  const aggregatedArticles = new Map<
    string,
    {
      feedName: string;
      readLater: number;
      starred: number;
      total: number;
      unread: number;
      userId: string;
    }
  >();
  const feedKeyById = new Map<number, string>();

  const countByFeedId = (
    groupedCounts: Array<{
      _count: {
        _all: number;
      };
      feedId: number;
    }>,
  ) =>
    new Map(groupedCounts.map(({ feedId, _count }) => [feedId, _count._all]));

  const totalByFeedId = countByFeedId(totalByFeed);
  const unreadByFeedId = countByFeedId(unreadByFeed);
  const readLaterByFeedId = countByFeedId(readLaterByFeed);
  const starredByFeedId = countByFeedId(starredByFeed);

  for (const feed of feedRows) {
    const key = `${feed.userId}\u0000${feed.title}`;
    feedKeyById.set(feed.id, key);

    if (aggregatedArticles.has(key)) {
      continue;
    }

    aggregatedArticles.set(key, {
      userId: feed.userId,
      feedName: feed.title,
      total: 0,
      unread: 0,
      readLater: 0,
      starred: 0,
    });
  }

  for (const feed of feedRows) {
    const key = feedKeyById.get(feed.id);

    if (!key) {
      continue;
    }

    const current = aggregatedArticles.get(key);

    if (!current) {
      continue;
    }

    current.total += totalByFeedId.get(feed.id) ?? 0;
    current.unread += unreadByFeedId.get(feed.id) ?? 0;
    current.readLater += readLaterByFeedId.get(feed.id) ?? 0;
    current.starred += starredByFeedId.get(feed.id) ?? 0;
  }

  return {
    usersTotal,
    feeds: feeds.map(({ userId, _count }) => ({
      userId,
      count: _count._all,
    })),
    articles: Array.from(aggregatedArticles.values()).sort((left, right) => {
      const userComparison = left.userId.localeCompare(right.userId);

      if (userComparison !== 0) {
        return userComparison;
      }

      return left.feedName.localeCompare(right.feedName);
    }),
  };
};
