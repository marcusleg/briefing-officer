import {
  createScheduler,
  enqueueDueFeedRefreshes,
  enqueueMissingLeads,
  purgeOldArticles,
  runCleanup,
} from "@/lib/jobs/scheduler";
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

let userId: string;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

beforeEach(async () => {
  userId = (await createUser()).id;
  delete process.env.FEED_REFRESH_INTERVAL_MINUTES;
});

describe("enqueueDueFeedRefreshes", () => {
  it("queues auto-refresh feeds whose last fetch is older than the interval", async () => {
    const due = await createFeed({ userId, link: "https://a.example/x" });
    await prisma.feed.update({
      where: { id: due.id },
      data: { lastFetched: minutesAgo(16) },
    });
    const fresh = await createFeed({ userId, link: "https://b.example/x" });
    await prisma.feed.update({
      where: { id: fresh.id },
      data: { lastFetched: minutesAgo(5) },
    });
    const paused = await createFeed({
      userId,
      autoRefresh: false,
      link: "https://c.example/x",
    });
    await prisma.feed.update({
      where: { id: paused.id },
      data: { lastFetched: minutesAgo(60) },
    });

    const queued = await enqueueDueFeedRefreshes();

    expect(queued).toBe(1);
    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "REFRESH_FEED", targetId: due.id });
  });

  it("respects FEED_REFRESH_INTERVAL_MINUTES", async () => {
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "60";
    const feed = await createFeed({ userId });
    await prisma.feed.update({
      where: { id: feed.id },
      data: { lastFetched: minutesAgo(30) },
    });

    expect(await enqueueDueFeedRefreshes()).toBe(0);
  });

  it("does not reset a job that already exists for the feed", async () => {
    const feed = await createFeed({ userId });
    await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: feed.id,
        status: "FAILED",
        attempts: 5,
      },
    });

    await enqueueDueFeedRefreshes();

    const [job] = await prisma.job.findMany();
    expect(job.status).toBe("FAILED");
  });
});

describe("enqueueMissingLeads", () => {
  it("queues recent articles that have no lead, whatever their status", async () => {
    const feed = await createFeed({ userId });
    const unread = await createArticle({ userId, feedId: feed.id });
    const readLater = await createArticle({
      userId,
      feedId: feed.id,
      status: "READ_LATER",
    });
    const read = await createArticle({
      userId,
      feedId: feed.id,
      status: "READ",
    });
    const withLead = await createArticle({ userId, feedId: feed.id });
    await prisma.articleLead.create({
      data: { articleId: withLead.id, text: "lead" },
    });
    const old = await createArticle({ userId, feedId: feed.id });
    await prisma.article.update({
      where: { id: old.id },
      data: { createdAt: daysAgo(2) },
    });

    const queued = await enqueueMissingLeads();

    expect(queued).toBe(3);
    const jobs = await prisma.job.findMany({ orderBy: { targetId: "asc" } });
    expect(jobs.map((job) => job.kind)).toEqual([
      "PROCESS_ARTICLE",
      "PROCESS_ARTICLE",
      "PROCESS_ARTICLE",
    ]);
    expect(jobs.map((job) => job.targetId)).toEqual([
      unread.id,
      readLater.id,
      read.id,
    ]);
  });
});

describe("purgeOldArticles", () => {
  it("deletes old articles except starred and read-later ones", async () => {
    const feed = await createFeed({ userId });
    await createArticle({
      userId,
      feedId: feed.id,
      publicationDate: daysAgo(400),
    });
    await createArticle({
      userId,
      feedId: feed.id,
      publicationDate: daysAgo(400),
      starred: true,
    });
    await createArticle({
      userId,
      feedId: feed.id,
      publicationDate: daysAgo(400),
      status: "READ_LATER",
    });
    await createArticle({ userId, feedId: feed.id });

    const deleted = await purgeOldArticles(365);

    expect(deleted).toBe(1);
    expect(await prisma.article.count()).toBe(3);
  });
});

describe("runCleanup", () => {
  it("purges articles and deletes stale failed jobs", async () => {
    const feed = await createFeed({ userId });
    await createArticle({
      userId,
      feedId: feed.id,
      publicationDate: daysAgo(400),
    });
    const stale = await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "FAILED" },
    });
    await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${minutesAgo(90)} WHERE "id" = ${stale.id}`;
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 2, status: "FAILED" },
    });

    await runCleanup();

    expect(await prisma.article.count()).toBe(0);
    expect((await prisma.job.findMany()).map((job) => job.targetId)).toEqual([
      2,
    ]);
  });
});

describe("createScheduler", () => {
  it("runs the sweeps and wakes the worker when something was queued", async () => {
    const feed = await createFeed({ userId });
    await prisma.feed.update({
      where: { id: feed.id },
      data: { lastFetched: minutesAgo(30) },
    });
    const wake = vi.fn();
    const scheduler = createScheduler({ intervalMs: 60 * 60_000, wake });

    await scheduler.runOnce();

    expect(await prisma.job.count()).toBe(1);
    expect(wake).toHaveBeenCalledOnce();
    scheduler.stop();
  });

  it("does not wake the worker when nothing was queued", async () => {
    const wake = vi.fn();
    const scheduler = createScheduler({ intervalMs: 60 * 60_000, wake });

    await scheduler.runOnce();

    expect(wake).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("runs cleanup on the first pass and not again within the hour", async () => {
    const feed = await createFeed({ userId });
    const scheduler = createScheduler({ intervalMs: 60 * 60_000 });
    await createArticle({
      userId,
      feedId: feed.id,
      publicationDate: daysAgo(400),
    });

    await scheduler.runOnce();
    expect(await prisma.article.count()).toBe(0);

    await createArticle({
      userId,
      feedId: feed.id,
      publicationDate: daysAgo(400),
    });
    await scheduler.runOnce();
    expect(await prisma.article.count()).toBe(1);
    scheduler.stop();
  });
});
