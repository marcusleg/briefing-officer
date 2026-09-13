import { enqueueMany } from "@/lib/jobs/jobRepository";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { scrapeFeed } from "@/lib/scraper";

/**
 * Fetches the feed, upserts its items, and queues one PROCESS_ARTICLE job per
 * article that did not exist before. Resolves to the owning user's id so the
 * worker can notify their open pages, or null when the feed is gone.
 */
export const refreshFeedJob = async (feedId: number) => {
  const feed = await prisma.feed.findUnique({ where: { id: feedId } });
  if (!feed) {
    logger.info({ feedId }, "Skipping refresh: feed no longer exists.");
    return null;
  }

  logger.debug({ feedId, feedTitle: feed.title }, "Refreshing feed.");

  const feedItems = await scrapeFeed(feed);

  const existingLinks = new Set(
    (
      await prisma.article.findMany({
        where: { feedId: feed.id, userId: feed.userId },
        select: { link: true },
      })
    ).map((article) => article.link),
  );

  const upserts = await Promise.allSettled(
    feedItems.map((item) =>
      prisma.article.upsert({
        where: {
          userId_feedId_link: {
            userId: feed.userId,
            feedId: feed.id,
            link: item.link,
          },
        },
        create: { ...item, feedId: feed.id, userId: feed.userId },
        update: { commentsLink: item.commentsLink, author: item.author },
      }),
    ),
  );

  const createdArticles = upserts
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((article) => !existingLinks.has(article.link));

  await enqueueMany(
    "PROCESS_ARTICLE",
    createdArticles.map((article) => article.id),
  );

  await prisma.feed.update({
    where: { id: feed.id },
    data: { lastFetched: new Date() },
  });

  logger.info(
    {
      feed: { id: feed.id, title: feed.title, link: feed.link },
      numberOfNewArticles: createdArticles.length,
    },
    "Feed refreshed. New articles queued for processing.",
  );

  return feed.userId;
};
