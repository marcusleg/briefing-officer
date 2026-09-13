import { Job, JobKind, Prisma } from "@/generated/prisma/client";
import { backoffMs, MAX_ATTEMPTS } from "@/lib/jobs/config";
import prisma from "@/lib/prismaClient";

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

/**
 * Creates the row if it is missing. A unique-constraint violation means a row
 * appeared between the caller's check and this insert, which is the same
 * outcome as finding it, so it is swallowed.
 */
const createIfAbsent = async (kind: JobKind, targetId: number) => {
  try {
    await prisma.job.create({ data: { kind, targetId } });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
};

/**
 * Queue the job to run now. A pending or failed row is reset so that a reader
 * who asks for a refresh is not made to wait out a backoff or a give-up. A
 * running row is left alone: the work is already happening.
 */
export const enqueue = async (kind: JobKind, targetId: number) => {
  const reset = await prisma.job.updateMany({
    where: { kind, targetId, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PENDING",
      attempts: 0,
      runAfter: new Date(),
      lastError: null,
    },
  });

  if (reset.count === 0) {
    await createIfAbsent(kind, targetId);
  }
};

/**
 * Queue the job only if nothing is queued, running, or failed for it. Used by
 * periodic sweeps so they never reset the attempt count of a retrying job.
 */
export const enqueueIfAbsent = (kind: JobKind, targetId: number) =>
  createIfAbsent(kind, targetId);

/**
 * Marks up to `limit` due pending jobs of `kind` as running and returns them.
 * Each claim is a guarded update so that two overlapping ticks cannot both
 * take the same job.
 */
export const claimDueJobs = async (kind: JobKind, limit: number) => {
  if (limit <= 0) {
    return [];
  }

  const due = await prisma.job.findMany({
    where: { kind, status: "PENDING", runAfter: { lte: new Date() } },
    orderBy: [{ runAfter: "asc" }, { id: "asc" }],
    take: limit,
  });

  const claimed: Job[] = [];
  for (const job of due) {
    const result = await prisma.job.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "RUNNING" },
    });
    if (result.count === 1) {
      claimed.push({ ...job, status: "RUNNING" });
    }
  }

  return claimed;
};

/** A finished job is deleted rather than kept: the unique key is the queue. */
export const completeJob = async (id: number) => {
  await prisma.job.deleteMany({ where: { id } });
};

/**
 * Records a failure. Below the attempt limit the job goes back to pending with
 * an exponential backoff; on the last attempt it is parked as failed with the
 * error text for inspection.
 */
export const failJob = async (job: Job, error: unknown) => {
  const attempts = job.attempts + 1;
  const lastError = error instanceof Error ? error.message : String(error);

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.job.updateMany({
      where: { id: job.id },
      data: { status: "FAILED", attempts, lastError },
    });
    return "FAILED" as const;
  }

  await prisma.job.updateMany({
    where: { id: job.id },
    data: {
      status: "PENDING",
      attempts,
      lastError,
      runAfter: new Date(Date.now() + backoffMs(attempts)),
    },
  });
  return "PENDING" as const;
};

/** A running job at startup can only be left over from a process that died. */
export const resetRunningJobs = async () => {
  const result = await prisma.job.updateMany({
    where: { status: "RUNNING" },
    data: { status: "PENDING" },
  });
  return result.count;
};

export const deleteStaleFailedJobs = async (olderThan: Date) => {
  const result = await prisma.job.deleteMany({
    where: { status: "FAILED", updatedAt: { lt: olderThan } },
  });
  return result.count;
};
