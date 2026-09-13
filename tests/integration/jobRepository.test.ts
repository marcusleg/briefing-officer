import {
  claimDueJobs,
  completeJob,
  deleteStaleFailedJobs,
  enqueue,
  enqueueIfAbsent,
  failJob,
  resetRunningJobs,
} from "@/lib/jobs/jobRepository";
import prisma from "@/lib/prismaClient";
import { describe, expect, it } from "vitest";

const jobs = () => prisma.job.findMany({ orderBy: { id: "asc" } });

describe("enqueue", () => {
  it("creates a pending job", async () => {
    await enqueue("REFRESH_FEED", 1);

    const [job] = await jobs();
    expect(job).toMatchObject({
      kind: "REFRESH_FEED",
      targetId: 1,
      status: "PENDING",
      attempts: 0,
    });
  });

  it("keeps one row per kind and target", async () => {
    await enqueue("REFRESH_FEED", 1);
    await enqueue("REFRESH_FEED", 1);

    expect(await prisma.job.count()).toBe(1);
  });

  it("resets a failed job to pending", async () => {
    await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: 1,
        status: "FAILED",
        attempts: 5,
        lastError: "boom",
        runAfter: new Date(Date.now() + 60_000),
      },
    });

    await enqueue("REFRESH_FEED", 1);

    const [job] = await jobs();
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(0);
    expect(job.lastError).toBeNull();
    expect(job.runAfter.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("brings a backed-off pending job forward", async () => {
    await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: 1,
        attempts: 2,
        runAfter: new Date(Date.now() + 60_000),
      },
    });

    await enqueue("REFRESH_FEED", 1);

    const [job] = await jobs();
    expect(job.attempts).toBe(0);
    expect(job.runAfter.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("leaves a running job alone", async () => {
    await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: 1,
        status: "RUNNING",
        attempts: 1,
      },
    });

    await enqueue("REFRESH_FEED", 1);

    const [job] = await jobs();
    expect(job.status).toBe("RUNNING");
    expect(job.attempts).toBe(1);
  });
});

describe("enqueueIfAbsent", () => {
  it("creates a job when none exists", async () => {
    await enqueueIfAbsent("PROCESS_ARTICLE", 7);
    expect(await prisma.job.count()).toBe(1);
  });

  it("does not touch an existing job of any status", async () => {
    await prisma.job.create({
      data: {
        kind: "PROCESS_ARTICLE",
        targetId: 7,
        status: "FAILED",
        attempts: 5,
      },
    });

    await enqueueIfAbsent("PROCESS_ARTICLE", 7);

    const [job] = await jobs();
    expect(job.status).toBe("FAILED");
    expect(job.attempts).toBe(5);
  });
});

describe("claimDueJobs", () => {
  it("claims only due pending jobs of the kind, oldest first, up to the limit", async () => {
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, runAfter: new Date(1_000) },
    });
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 2, runAfter: new Date(2_000) },
    });
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 3, runAfter: new Date(3_000) },
    });
    await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: 4,
        runAfter: new Date(Date.now() + 60_000),
      },
    });
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 5, status: "RUNNING" },
    });
    await prisma.job.create({
      data: { kind: "PROCESS_ARTICLE", targetId: 1 },
    });

    const claimed = await claimDueJobs("REFRESH_FEED", 2);

    expect(claimed.map((job) => job.targetId)).toEqual([1, 2]);
    expect(claimed.every((job) => job.status === "RUNNING")).toBe(true);
    const running = await prisma.job.findMany({
      where: { status: "RUNNING", kind: "REFRESH_FEED" },
    });
    expect(running.map((job) => job.targetId).sort()).toEqual([1, 2, 5]);
  });

  it("returns nothing for a non-positive limit", async () => {
    await prisma.job.create({ data: { kind: "REFRESH_FEED", targetId: 1 } });
    expect(await claimDueJobs("REFRESH_FEED", 0)).toEqual([]);
  });
});

describe("completeJob", () => {
  it("deletes the job", async () => {
    const job = await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "RUNNING" },
    });

    await completeJob(job.id);

    expect(await prisma.job.count()).toBe(0);
  });

  it("tolerates a job that is already gone", async () => {
    await expect(completeJob(999)).resolves.toBeUndefined();
  });
});

describe("failJob", () => {
  it("schedules a retry with backoff and records the error", async () => {
    const job = await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "RUNNING" },
    });
    const before = Date.now();

    const outcome = await failJob(job, new Error("boom"));

    expect(outcome).toBe("PENDING");
    const updated = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(updated.status).toBe("PENDING");
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe("boom");
    expect(updated.runAfter.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(updated.runAfter.getTime()).toBeLessThan(before + 61_000);
  });

  it("doubles the backoff with each failure", async () => {
    const job = await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: 1,
        status: "RUNNING",
        attempts: 2,
      },
    });
    const before = Date.now();

    await failJob(job, new Error("boom"));

    const updated = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(updated.attempts).toBe(3);
    expect(updated.runAfter.getTime()).toBeGreaterThanOrEqual(
      before + 4 * 60_000,
    );
  });

  it("marks the job failed on the fifth failure", async () => {
    const job = await prisma.job.create({
      data: {
        kind: "REFRESH_FEED",
        targetId: 1,
        status: "RUNNING",
        attempts: 4,
      },
    });

    const outcome = await failJob(job, "not an Error instance");

    expect(outcome).toBe("FAILED");
    const updated = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(updated.status).toBe("FAILED");
    expect(updated.attempts).toBe(5);
    expect(updated.lastError).toBe("not an Error instance");
  });
});

describe("resetRunningJobs", () => {
  it("returns running jobs to pending and reports how many", async () => {
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "RUNNING" },
    });
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 2, status: "FAILED" },
    });

    expect(await resetRunningJobs()).toBe(1);

    const statuses = (await jobs()).map((job) => job.status);
    expect(statuses).toEqual(["PENDING", "FAILED"]);
  });
});

describe("deleteStaleFailedJobs", () => {
  it("deletes failed jobs last updated before the cutoff", async () => {
    const old = await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "FAILED" },
    });
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 2, status: "FAILED" },
    });
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 3, status: "PENDING" },
    });
    // `updatedAt` is set by Prisma; push one row into the past by hand.
    await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${new Date(Date.now() - 2 * 60 * 60_000)} WHERE "id" = ${old.id}`;

    const deleted = await deleteStaleFailedJobs(
      new Date(Date.now() - 60 * 60_000),
    );

    expect(deleted).toBe(1);
    expect((await jobs()).map((job) => job.targetId)).toEqual([2, 3]);
  });
});
