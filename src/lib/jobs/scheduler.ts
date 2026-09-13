import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import {
  CLEANUP_INTERVAL_MS,
  FAILED_JOB_RETENTION_MS,
  feedRefreshIntervalMs,
  MISSING_LEAD_LOOKBACK_MS,
  SCHEDULER_INTERVAL_MS,
} from "@/lib/jobs/config";
import {
  deleteStaleFailedJobs,
  enqueueManyIfAbsent,
} from "@/lib/jobs/jobRepository";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";

/**
 * Queues a refresh for every auto-refresh feed whose last fetch is older than
 * the interval. Keying off each feed's own timestamp needs no record of when
 * the scheduler last ran and catches up on its own after downtime.
 */
export const enqueueDueFeedRefreshes = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - feedRefreshIntervalMs());
  const feeds = await prisma.feed.findMany({
    where: { autoRefresh: true, lastFetched: { lte: cutoff } },
    select: { id: true },
  });

  await enqueueManyIfAbsent(
    "REFRESH_FEED",
    feeds.map((feed) => feed.id),
  );

  return feeds.length;
};

/**
 * Queues processing for recent articles that still have no lead, which covers
 * leads whose job failed for good. Status is deliberately not a filter: the
 * card shows a placeholder for a missing lead on the read-later, history and
 * filtered pages too, so an article the reader moved out of the inbox before
 * its lead landed needs the retry as much as an unread one. Older articles are
 * left alone.
 */
export const enqueueMissingLeads = async (now = new Date()) => {
  const since = new Date(now.getTime() - MISSING_LEAD_LOOKBACK_MS);
  const articles = await prisma.article.findMany({
    where: { lead: null, createdAt: { gte: since } },
    select: { id: true },
  });

  await enqueueManyIfAbsent(
    "PROCESS_ARTICLE",
    articles.map((article) => article.id),
  );

  return articles.length;
};

export const purgeOldArticles = async (days = ARTICLE_RETENTION_DAYS) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await prisma.article.deleteMany({
    where: {
      publicationDate: { lte: cutoff },
      status: { not: "READ_LATER" },
      starred: false,
    },
  });

  if (result.count > 0) {
    logger.info({ count: result.count, days }, "Deleted old articles.");
  }

  return result.count;
};

export const runCleanup = async (now = new Date()) => {
  await purgeOldArticles();
  const deleted = await deleteStaleFailedJobs(
    new Date(now.getTime() - FAILED_JOB_RETENTION_MS),
  );
  if (deleted > 0) {
    logger.info({ count: deleted }, "Deleted stale failed jobs.");
  }
};

interface SchedulerOptions {
  intervalMs?: number;
  /** Called after a pass that queued something, so the worker starts at once. */
  wake?: () => void;
}

export const createScheduler = (options: SchedulerOptions = {}) => {
  const intervalMs = options.intervalMs ?? SCHEDULER_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastCleanupAt: number | undefined;

  const runOnce = async () => {
    const now = new Date();
    try {
      const refreshes = await enqueueDueFeedRefreshes(now);
      const leads = await enqueueMissingLeads(now);

      if (
        lastCleanupAt === undefined ||
        now.getTime() - lastCleanupAt >= CLEANUP_INTERVAL_MS
      ) {
        await runCleanup(now);
        lastCleanupAt = now.getTime();
      }

      if (refreshes + leads > 0) {
        logger.debug({ refreshes, leads }, "Scheduler queued work.");
        options.wake?.();
      }
    } catch (error) {
      logger.error({ err: error }, "Scheduler pass failed.");
    }
  };

  const start = () => {
    if (timer) {
      return;
    }
    void runOnce();
    timer = setInterval(() => void runOnce(), intervalMs);
  };

  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };

  return { start, stop, runOnce };
};
