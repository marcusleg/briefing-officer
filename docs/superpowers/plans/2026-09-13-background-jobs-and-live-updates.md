# Background Jobs and Live Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move feed refreshes, article scraping, and AI lead generation into a
durable in-process background worker backed by a SQLite job table, replace the
external cron trigger with an in-process scheduler, and push "something changed"
events to open browser tabs over Server-Sent Events so pages refresh themselves
and hold new articles behind a "Show N new articles" button.

**Architecture:** A `Job` table with a unique `(kind, targetId)` key is the
queue. `src/lib/jobs/worker.ts` claims due jobs and runs one handler per kind
under per-kind concurrency caps with exponential backoff.
`src/lib/jobs/scheduler.ts` ticks every minute to enqueue overdue feed
refreshes, sweep lead-less articles, and run hourly cleanup. Both start from
`src/instrumentation.ts`. Finished jobs call `notifyUser(userId)` on an
in-memory bus; `GET /api/events` streams that to the browser; a `LiveUpdates`
client provider calls `router.refresh()`; and `ArticleList` keeps a set of seen
ids so unseen articles are counted, not shown.

**Tech Stack:** Next.js 16 (App Router, `instrumentation.ts`, route handlers),
Prisma 7 with the better-sqlite3 adapter, React 19, Vitest 4 with the existing
`node` (integration, per-worker SQLite) and `components` (jsdom) projects,
sonner toasts, Tailwind.

## Global Constraints

- Spec:
  `docs/superpowers/specs/2026-09-13-background-jobs-and-live-updates-design.md`.
- Conventional Commits without scopes. `feat:` and `fix:` first lines are
  written for end users.
- Husky runs `lint-staged` on commit. Never `--no-verify`. Run `npm run format`
  before pushing.
- CI gates: `npm run format:check`, `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run build`.
- Prisma on SQLite: no `createMany({ skipDuplicates })`, no
  `mode: "insensitive"`. Unique constraint violations surface as
  `Prisma.PrismaClientKnownRequestError` with `code === "P2002"`.
- Server actions live in files starting with `"use server"`. Files the worker
  imports must not be server-action files unless they already are and stay
  callable server-side (`feedRepository.ts` stays one).
- Do not call `revalidatePath` from worker, scheduler, or handler code. It
  throws outside a request scope.
- Concurrency caps: `REFRESH_FEED: 3`, `PROCESS_ARTICLE: 4`. Max attempts: 5.
  Backoff: 1 minute doubled per previous failure (1, 2, 4, 8 minutes). Poll
  interval: 5 s. Scheduler interval: 60 s. Cleanup interval: 1 h. Failed job
  retention: 1 h. Missing-lead lookback: 24 h. SSE heartbeat: 20 s. Router
  refresh throttle: 2 s. User-refresh auto-merge window: 5 min.
- Environment variables: `FEED_REFRESH_INTERVAL_MINUTES` (default 15),
  `BACKGROUND_WORKER_DISABLED` (`"true"` disables the worker).
- Toast copy after a refresh click: "Refresh started. New articles will appear
  as they arrive."
- Indicator copy: "Show 1 new article" / "Show N new articles".

---

## File Structure

| Path                                                       | Responsibility                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                     | Add `JobKind`, `JobStatus`, `Job`.                                                      |
| `prisma/migrations/<ts>_add_job_table/migration.sql`       | Generated migration.                                                                    |
| `src/lib/jobs/config.ts`                                   | Constants, env parsing, backoff formula.                                                |
| `src/lib/jobs/jobRepository.ts`                            | Job table access: enqueue, enqueueIfAbsent, claimDueJobs, completeJob, failJob, resets. |
| `src/lib/jobs/handlers/refreshFeedJob.ts`                  | Fetch a feed, upsert articles, enqueue `PROCESS_ARTICLE` per new article.               |
| `src/lib/jobs/handlers/processArticleJob.ts`               | Scrape if needed, then `generateAiLead`.                                                |
| `src/lib/jobs/handlers/index.ts`                           | `handlers` map by `JobKind`.                                                            |
| `src/lib/jobs/worker.ts`                                   | `createWorker`, global handle, `wakeWorker`.                                            |
| `src/lib/jobs/scheduler.ts`                                | Due refreshes, missing-lead sweep, purge, cleanup, `createScheduler`.                   |
| `src/lib/jobs/start.ts`                                    | `startBackgroundWork()`: wires worker + scheduler, stores on `globalThis`.              |
| `src/instrumentation.ts`                                   | `register()` guard and dynamic import.                                                  |
| `src/lib/events/userEvents.ts`                             | `notifyUser`, `subscribe`.                                                              |
| `src/app/api/events/route.ts`                              | SSE stream.                                                                             |
| `src/components/live-updates.tsx`                          | `LiveUpdates` provider, `useLiveUpdates`, `LiveUpdatesContext`.                         |
| `src/components/article/article-list.tsx`                  | Seen-id set, held count, "Show N new articles" button.                                  |
| `src/app/feed/layout.tsx`                                  | Wrap children in `LiveUpdates`.                                                         |
| `src/app/feed/[feedId]/page.tsx`                           | `key={showSearchParam}` on `ArticleList`.                                               |
| `src/app/feed/refresh-all-feeds-button.tsx` and 2 siblings | Toast copy, `noteUserRefresh()`.                                                        |
| `src/lib/repository/feedRepository.ts`                     | Refresh actions enqueue; ownership checks; drop processing code.                        |
| `src/lib/repository/articleRepository.ts`                  | Remove `deleteArticlesOlderThanXDays` (moves to scheduler).                             |
| `src/components/article/article-card.tsx`                  | Drop client-side lead generation.                                                       |
| `src/lib/scraper.ts`, `src/lib/ai/services/leadService.ts` | Drop `"use server"`.                                                                    |
| `src/app/api/cron/route.ts`                                | Delete.                                                                                 |
| `helm-chart/templates/cronjob.yaml`, `networkpolicy.yaml`  | Delete CronJob; drop the cronjob NetworkPolicy.                                         |
| `README.md`, `.env.example`, `Containerfile`               | Drop `CRON_API_TOKEN`; document new variables.                                          |
| `playwright.config.ts`, `playwright.screenshots.config.ts` | `BACKGROUND_WORKER_DISABLED: "true"` in `webServer.env`.                                |
| `docs/prd.md`                                              | Reflect the new behaviour.                                                              |
| `tests/helpers/db.ts`                                      | `prisma.job.deleteMany()`.                                                              |
| `tests/integration/jobRepository.test.ts`                  | Repository behaviour.                                                                   |
| `tests/integration/worker.test.ts`                         | Loop with stub handlers.                                                                |
| `tests/integration/refreshFeedJob.test.ts`                 | Refresh handler.                                                                        |
| `tests/integration/processArticleJob.test.ts`              | Process handler.                                                                        |
| `tests/integration/scheduler.test.ts`                      | Scheduler selection and cleanup.                                                        |
| `tests/integration/eventsRoute.test.ts`                    | SSE route.                                                                              |
| `tests/unit/userEvents.test.ts`                            | Bus.                                                                                    |
| `tests/unit/jobsConfig.test.ts`                            | Backoff and interval parsing.                                                           |
| `tests/components/live-updates.test.tsx`                   | Provider throttle.                                                                      |
| `tests/components/article/article-list.test.tsx`           | Holding behaviour.                                                                      |
| `tests/components/feed/refresh-buttons.test.tsx`           | Buttons.                                                                                |
| `tests/integration/feedRepository.test.ts`                 | Refresh actions enqueue.                                                                |

---

### Task 1: Job table

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_job_table/migration.sql`
  (generated)
- Modify: `tests/helpers/db.ts`

**Interfaces:**

- Produces: Prisma model
  `Job { id, kind: JobKind, targetId, status: JobStatus, attempts, runAfter, lastError, createdAt, updatedAt }`,
  enums `JobKind { REFRESH_FEED, PROCESS_ARTICLE }`,
  `JobStatus { PENDING, RUNNING, FAILED }`.

- [ ] **Step 1: Add the model to the schema**

Append to `prisma/schema.prisma` after the `FeedFilterKind` enum:

```prisma
enum JobKind {
  REFRESH_FEED
  PROCESS_ARTICLE
}

enum JobStatus {
  PENDING
  RUNNING
  FAILED
}
```

And after the `TokenUsage` model:

```prisma
model Job {
  id        Int       @id @default(autoincrement())
  kind      JobKind
  targetId  Int
  status    JobStatus @default(PENDING)
  attempts  Int       @default(0)
  runAfter  DateTime  @default(now())
  lastError String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([kind, targetId])
  @@index([status, runAfter])
}
```

- [ ] **Step 2: Generate the migration and client**

Run: `npx prisma migrate dev --name add-job-table` Expected: a new folder under
`prisma/migrations/` containing `CREATE TABLE "Job"`, and "Generated Prisma
Client".

If the CLI refuses because of the AI-agent data-loss guard, run
`npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`
into a new `prisma/migrations/<YYYYMMDDHHMMSS>_add_job_table/migration.sql`,
then `npx prisma migrate deploy` and `npx prisma generate`.

- [ ] **Step 3: Reset the table between tests**

In `tests/helpers/db.ts`, add as the first line of `resetDb`:

```ts
await prisma.job.deleteMany();
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test` Expected: PASS (274 tests).

- [ ] **Step 5: Commit**

```bash
git add prisma tests/helpers/db.ts
git commit -m "feat: add job table for background work"
```

---

### Task 2: Job config and repository

**Files:**

- Create: `src/lib/jobs/config.ts`
- Create: `src/lib/jobs/jobRepository.ts`
- Test: `tests/unit/jobsConfig.test.ts`,
  `tests/integration/jobRepository.test.ts`

**Interfaces:**

- Produces:
  - `config.ts`: `MAX_ATTEMPTS = 5`, `POLL_INTERVAL_MS = 5000`,
    `SCHEDULER_INTERVAL_MS = 60000`, `CLEANUP_INTERVAL_MS = 3600000`,
    `FAILED_JOB_RETENTION_MS = 3600000`, `MISSING_LEAD_LOOKBACK_MS = 86400000`,
    `CONCURRENCY: Record<JobKind, number>`,
    `backoffMs(failures: number): number`, `feedRefreshIntervalMs(): number`.
  - `jobRepository.ts`: `enqueue(kind, targetId): Promise<void>`,
    `enqueueIfAbsent(kind, targetId): Promise<void>`,
    `claimDueJobs(kind, limit): Promise<Job[]>`,
    `completeJob(id): Promise<void>`,
    `failJob(job, error): Promise<"PENDING" | "FAILED">`,
    `resetRunningJobs(): Promise<number>`,
    `deleteStaleFailedJobs(olderThan: Date): Promise<number>`.

- [ ] **Step 1: Write the failing unit test for config**

`tests/unit/jobsConfig.test.ts`:

```ts
import { backoffMs, feedRefreshIntervalMs } from "@/lib/jobs/config";
import { afterEach, describe, expect, it } from "vitest";

describe("backoffMs", () => {
  it("doubles from one minute per previous failure", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(4)).toBe(480_000);
  });
});

describe("feedRefreshIntervalMs", () => {
  const original = process.env.FEED_REFRESH_INTERVAL_MINUTES;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.FEED_REFRESH_INTERVAL_MINUTES;
    } else {
      process.env.FEED_REFRESH_INTERVAL_MINUTES = original;
    }
  });

  it("defaults to 15 minutes", () => {
    delete process.env.FEED_REFRESH_INTERVAL_MINUTES;
    expect(feedRefreshIntervalMs()).toBe(15 * 60_000);
  });

  it("reads the environment variable in minutes", () => {
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "5";
    expect(feedRefreshIntervalMs()).toBe(5 * 60_000);
  });

  it("falls back to the default for unusable values", () => {
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "soon";
    expect(feedRefreshIntervalMs()).toBe(15 * 60_000);
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "0";
    expect(feedRefreshIntervalMs()).toBe(15 * 60_000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/jobsConfig.test.ts` Expected: FAIL, cannot
resolve `@/lib/jobs/config`.

- [ ] **Step 3: Write config**

`src/lib/jobs/config.ts`:

```ts
import { JobKind } from "@/generated/prisma/client";

export const MAX_ATTEMPTS = 5;
export const POLL_INTERVAL_MS = 5_000;
export const SCHEDULER_INTERVAL_MS = 60_000;
export const CLEANUP_INTERVAL_MS = 60 * 60_000;
export const FAILED_JOB_RETENTION_MS = 60 * 60_000;
export const MISSING_LEAD_LOOKBACK_MS = 24 * 60 * 60_000;

const BASE_BACKOFF_MS = 60_000;
const DEFAULT_FEED_REFRESH_INTERVAL_MINUTES = 15;

/** How many jobs of each kind may run at the same time. */
export const CONCURRENCY: Record<JobKind, number> = {
  REFRESH_FEED: 3,
  PROCESS_ARTICLE: 4,
};

/** Delay before the next attempt after `failures` failures so far (>= 1). */
export const backoffMs = (failures: number) =>
  BASE_BACKOFF_MS * 2 ** (failures - 1);

export const feedRefreshIntervalMs = () => {
  const minutes = Number(process.env.FEED_REFRESH_INTERVAL_MINUTES);
  const valid = Number.isFinite(minutes) && minutes > 0;
  return (valid ? minutes : DEFAULT_FEED_REFRESH_INTERVAL_MINUTES) * 60_000;
};
```

- [ ] **Step 4: Run the unit test**

Run: `npx vitest run tests/unit/jobsConfig.test.ts` Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing integration test for the repository**

`tests/integration/jobRepository.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import {
  claimDueJobs,
  completeJob,
  deleteStaleFailedJobs,
  enqueue,
  enqueueIfAbsent,
  failJob,
  resetRunningJobs,
} from "@/lib/jobs/jobRepository";
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/integration/jobRepository.test.ts` Expected: FAIL,
cannot resolve `@/lib/jobs/jobRepository`.

- [ ] **Step 7: Write the repository**

`src/lib/jobs/jobRepository.ts`:

```ts
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
```

- [ ] **Step 8: Run the integration test**

Run: `npx vitest run tests/integration/jobRepository.test.ts` Expected: PASS (15
tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/jobs/config.ts src/lib/jobs/jobRepository.ts tests/unit/jobsConfig.test.ts tests/integration/jobRepository.test.ts
git commit -m "feat: add job repository with retry and backoff"
```

---

### Task 3: User event bus

**Files:**

- Create: `src/lib/events/userEvents.ts`
- Test: `tests/unit/userEvents.test.ts`

**Interfaces:**

- Produces: `notifyUser(userId: string): void`,
  `subscribe(userId: string, listener: () => void): () => void`.

- [ ] **Step 1: Write the failing test**

`tests/unit/userEvents.test.ts`:

```ts
import { notifyUser, subscribe } from "@/lib/events/userEvents";
import { describe, expect, it, vi } from "vitest";

describe("userEvents", () => {
  it("delivers a notification to that user's subscribers only", () => {
    const alice = vi.fn();
    const bob = vi.fn();
    const stopAlice = subscribe("alice", alice);
    const stopBob = subscribe("bob", bob);

    notifyUser("alice");

    expect(alice).toHaveBeenCalledOnce();
    expect(bob).not.toHaveBeenCalled();
    stopAlice();
    stopBob();
  });

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn();
    const stop = subscribe("carol", listener);

    stop();
    notifyUser("carol");

    expect(listener).not.toHaveBeenCalled();
  });

  it("is a no-op for a user with no subscribers", () => {
    expect(() => notifyUser("nobody")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/userEvents.test.ts` Expected: FAIL, cannot
resolve `@/lib/events/userEvents`.

- [ ] **Step 3: Write the bus**

`src/lib/events/userEvents.ts`:

```ts
import { EventEmitter } from "events";

/**
 * Next.js compiles instrumentation, route handlers, and server actions into
 * separate module graphs, so a module-level singleton would not be the same
 * object in the worker and in the SSE route. The emitter is kept on
 * `globalThis` instead, which every graph in the process shares.
 */
const GLOBAL_KEY = "__briefingOfficerUserEvents";

type GlobalWithEmitter = typeof globalThis & {
  [GLOBAL_KEY]?: EventEmitter;
};

const emitter = () => {
  const global = globalThis as GlobalWithEmitter;
  if (!global[GLOBAL_KEY]) {
    const created = new EventEmitter();
    // One listener per open browser tab; the default cap of 10 would warn.
    created.setMaxListeners(0);
    global[GLOBAL_KEY] = created;
  }
  return global[GLOBAL_KEY];
};

/** Tell every open page of this user that something they see has changed. */
export const notifyUser = (userId: string) => {
  emitter().emit(userId);
};

/** Returns the function that unsubscribes. */
export const subscribe = (userId: string, listener: () => void) => {
  emitter().on(userId, listener);
  return () => {
    emitter().off(userId, listener);
  };
};
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/userEvents.test.ts` Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/userEvents.ts tests/unit/userEvents.test.ts
git commit -m "feat: add in-memory per-user event bus"
```

---

### Task 4: Job handlers

**Files:**

- Create: `src/lib/jobs/handlers/refreshFeedJob.ts`
- Create: `src/lib/jobs/handlers/processArticleJob.ts`
- Create: `src/lib/jobs/handlers/index.ts`
- Modify: `src/lib/scraper.ts:1` (drop `"use server"`)
- Modify: `src/lib/ai/services/leadService.ts:1` (drop `"use server"`)
- Test: `tests/integration/refreshFeedJob.test.ts`,
  `tests/integration/processArticleJob.test.ts`

**Interfaces:**

- Consumes: `enqueue` from Task 2; `scrapeFeed(feed: Feed)`,
  `scrapeArticle(articleId, link)` from `@/lib/scraper`;
  `generateAiLead(articleId)` from `@/lib/ai/services/leadService`.
- Produces: `type JobHandler = (targetId: number) => Promise<string | null>`;
  `refreshFeedJob: JobHandler`; `processArticleJob: JobHandler`;
  `handlers: Record<JobKind, JobHandler>`.

- [ ] **Step 1: Drop the server-action directives**

Delete the first line `"use server";` and the blank line after it from
`src/lib/scraper.ts` and from `src/lib/ai/services/leadService.ts`. Nothing on
the client will import them after Task 10, and the directive exposed
`scrapeArticle` and `generateAiLead` as endpoints without an ownership check.

- [ ] **Step 2: Write the failing refresh handler test**

`tests/integration/refreshFeedJob.test.ts`:

```ts
import type { Feed } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));

import { refreshFeedJob } from "@/lib/jobs/handlers/refreshFeedJob";
import { scrapeFeed } from "@/lib/scraper";

let userId: string;

const feedItem = (title: string, link: string) => ({
  title,
  link,
  description: null,
  publicationDate: new Date(),
  commentsLink: null,
  author: null,
});

beforeEach(async () => {
  userId = (await createUser()).id;
  vi.mocked(scrapeFeed).mockResolvedValue([]);
});

describe("refreshFeedJob", () => {
  it("creates articles returned by the scraper and updates lastFetched", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
      feedItem("Second", "https://example.com/2"),
    ]);

    const owner = await refreshFeedJob(feed.id);

    expect(owner).toBe(userId);
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(2);
    const refreshed = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(refreshed.lastFetched.getTime()).toBeGreaterThan(0);
  });

  it("enqueues one PROCESS_ARTICLE job per new article and none for known ones", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
    ]);
    await refreshFeedJob(feed.id);
    await prisma.job.deleteMany();

    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
      feedItem("Second", "https://example.com/2"),
    ]);
    await refreshFeedJob(feed.id);

    const jobs = await prisma.job.findMany();
    const second = await prisma.article.findFirstOrThrow({
      where: { link: "https://example.com/2" },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: "PROCESS_ARTICLE",
      targetId: second.id,
      status: "PENDING",
    });
  });

  it("updates commentsLink on an existing article", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("Article", "https://example.com/1"),
    ]);
    await refreshFeedJob(feed.id);

    vi.mocked(scrapeFeed).mockResolvedValue([
      {
        ...feedItem("Article", "https://example.com/1"),
        commentsLink: "https://example.com/1#comments",
      },
    ]);
    await refreshFeedJob(feed.id);

    const article = await prisma.article.findFirstOrThrow({
      where: { feedId: feed.id },
    });
    expect(article.commentsLink).toBe("https://example.com/1#comments");
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(1);
  });

  it("returns null and does nothing for a feed that no longer exists", async () => {
    const owner = await refreshFeedJob(999_999);

    expect(owner).toBeNull();
    expect(vi.mocked(scrapeFeed)).not.toHaveBeenCalled();
  });

  it("propagates a scraper failure and leaves lastFetched unchanged", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockRejectedValue(new Error("unreachable"));

    await expect(refreshFeedJob(feed.id)).rejects.toThrow("unreachable");

    const unchanged = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(unchanged.lastFetched.getTime()).toBe(0);
  });

  it("passes the whole feed row to the scraper", async () => {
    const feed = await createFeed({ userId });

    await refreshFeedJob(feed.id);

    const passed = vi.mocked(scrapeFeed).mock.calls[0][0] as Feed;
    expect(passed.id).toBe(feed.id);
    expect(passed.link).toBe(feed.link);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/integration/refreshFeedJob.test.ts` Expected: FAIL,
cannot resolve `@/lib/jobs/handlers/refreshFeedJob`.

- [ ] **Step 4: Write the refresh handler**

`src/lib/jobs/handlers/refreshFeedJob.ts`:

```ts
import { enqueue } from "@/lib/jobs/jobRepository";
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

  for (const article of createdArticles) {
    await enqueue("PROCESS_ARTICLE", article.id);
  }

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
```

- [ ] **Step 5: Run the refresh handler test**

Run: `npx vitest run tests/integration/refreshFeedJob.test.ts` Expected: PASS (6
tests).

- [ ] **Step 6: Write the failing process handler test**

`tests/integration/processArticleJob.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));
vi.mock("@/lib/ai/services/leadService", () => ({
  generateAiLead: vi.fn(),
}));

import { generateAiLead } from "@/lib/ai/services/leadService";
import { processArticleJob } from "@/lib/jobs/handlers/processArticleJob";
import { scrapeArticle } from "@/lib/scraper";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
  vi.mocked(scrapeArticle).mockResolvedValue(undefined as never);
  vi.mocked(generateAiLead).mockResolvedValue("lead");
});

describe("processArticleJob", () => {
  it("scrapes then generates the lead and returns the owner", async () => {
    const article = await createArticle({ userId, feedId });

    const owner = await processArticleJob(article.id);

    expect(owner).toBe(userId);
    expect(scrapeArticle).toHaveBeenCalledWith(article.id, article.link);
    expect(generateAiLead).toHaveBeenCalledWith(article.id);
  });

  it("skips scraping when a scrape already exists", async () => {
    const article = await createArticle({ userId, feedId });
    await prisma.articleScrape.create({
      data: { articleId: article.id, textContent: "body", author: "" },
    });

    await processArticleJob(article.id);

    expect(scrapeArticle).not.toHaveBeenCalled();
    expect(generateAiLead).toHaveBeenCalledWith(article.id);
  });

  it("still generates the lead when scraping fails", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(scrapeArticle).mockRejectedValue(new Error("404"));

    const owner = await processArticleJob(article.id);

    expect(owner).toBe(userId);
    expect(generateAiLead).toHaveBeenCalledWith(article.id);
  });

  it("propagates a lead generation failure", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(generateAiLead).mockRejectedValue(new Error("rate limited"));

    await expect(processArticleJob(article.id)).rejects.toThrow("rate limited");
  });

  it("returns null and does nothing for a missing article", async () => {
    const owner = await processArticleJob(999_999);

    expect(owner).toBeNull();
    expect(scrapeArticle).not.toHaveBeenCalled();
    expect(generateAiLead).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/integration/processArticleJob.test.ts` Expected:
FAIL, cannot resolve `@/lib/jobs/handlers/processArticleJob`.

- [ ] **Step 8: Write the process handler and the handler map**

`src/lib/jobs/handlers/processArticleJob.ts`:

```ts
import { generateAiLead } from "@/lib/ai/services/leadService";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { scrapeArticle } from "@/lib/scraper";

/**
 * Scrapes the article unless a scrape already exists, then generates its lead
 * and filter verdict. A scrape failure is logged and the lead is generated
 * from the title alone, as before; a lead failure fails the job so it is
 * retried. Resolves to the owning user's id, or null when the article is gone.
 */
export const processArticleJob = async (articleId: number) => {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { scrape: true },
  });
  if (!article) {
    logger.info({ articleId }, "Skipping article: it no longer exists.");
    return null;
  }

  if (!article.scrape) {
    try {
      await scrapeArticle(article.id, article.link);
    } catch (error) {
      logger.error(
        {
          err: error,
          article: { id: article.id, title: article.title, link: article.link },
        },
        "Failed to scrape article.",
      );
    }
  }

  await generateAiLead(article.id);

  return article.userId;
};
```

`src/lib/jobs/handlers/index.ts`:

```ts
import { JobKind } from "@/generated/prisma/client";
import { processArticleJob } from "@/lib/jobs/handlers/processArticleJob";
import { refreshFeedJob } from "@/lib/jobs/handlers/refreshFeedJob";

/** Resolves to the owning user's id, or null when the target no longer exists. */
export type JobHandler = (targetId: number) => Promise<string | null>;

export const handlers: Record<JobKind, JobHandler> = {
  REFRESH_FEED: refreshFeedJob,
  PROCESS_ARTICLE: processArticleJob,
};
```

- [ ] **Step 9: Run both handler tests**

Run:
`npx vitest run tests/integration/refreshFeedJob.test.ts tests/integration/processArticleJob.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/jobs/handlers src/lib/scraper.ts src/lib/ai/services/leadService.ts tests/integration/refreshFeedJob.test.ts tests/integration/processArticleJob.test.ts
git commit -m "feat: add feed refresh and article processing job handlers"
```

---

### Task 5: Worker loop

**Files:**

- Create: `src/lib/jobs/worker.ts`
- Test: `tests/integration/worker.test.ts`

**Interfaces:**

- Consumes: `claimDueJobs`, `completeJob`, `failJob`, `resetRunningJobs` (Task
  2); `notifyUser` (Task 3); `JobHandler` (Task 4); `CONCURRENCY`,
  `POLL_INTERVAL_MS` (Task 2).
- Produces:
  `createWorker(handlers: Record<JobKind, JobHandler>, options?: { pollIntervalMs?: number; concurrency?: Record<JobKind, number> }): Worker`
  where
  `Worker = { start(): Promise<void>; stop(): void; wake(): void; tick(): Promise<void> }`;
  `wakeWorker(): void`; `setGlobalWorker(worker: Worker | undefined): void`.

- [ ] **Step 1: Write the failing test**

`tests/integration/worker.test.ts`:

```ts
import { notifyUser } from "@/lib/events/userEvents";
import { enqueue } from "@/lib/jobs/jobRepository";
import { createWorker, setGlobalWorker, wakeWorker } from "@/lib/jobs/worker";
import prisma from "@/lib/prismaClient";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events/userEvents", () => ({
  notifyUser: vi.fn(),
}));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const idle = { pollIntervalMs: 60 * 60_000 };
let worker: ReturnType<typeof createWorker> | undefined;

afterEach(() => {
  worker?.stop();
  worker = undefined;
  setGlobalWorker(undefined);
});

describe("worker", () => {
  it("runs a due job, deletes it, and notifies the owner", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await enqueue("REFRESH_FEED", 1);

    await worker.start();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(handler).toHaveBeenCalledWith(1);
    expect(notifyUser).toHaveBeenCalledWith("user-1");
  });

  it("does not notify when the handler reports no owner", async () => {
    const handler = vi.fn(async () => null);
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await enqueue("REFRESH_FEED", 1);

    await worker.start();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("caps concurrency per kind and drains the rest afterwards", async () => {
    const gate = deferred();
    let started = 0;
    const handler = vi.fn(async () => {
      started += 1;
      await gate.promise;
      return "user-1";
    });
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      { ...idle, concurrency: { REFRESH_FEED: 1, PROCESS_ARTICLE: 2 } },
    );
    for (const id of [1, 2, 3]) {
      await enqueue("PROCESS_ARTICLE", id);
    }

    await worker.start();
    await vi.waitFor(() => expect(started).toBe(2));
    await worker.tick();
    expect(started).toBe(2);

    gate.resolve();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(started).toBe(3);
  });

  it("retries a failing job with backoff", async () => {
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await enqueue("REFRESH_FEED", 1);

    await worker.start();

    await vi.waitFor(async () => {
      const [job] = await prisma.job.findMany();
      expect(job.status).toBe("PENDING");
      expect(job.attempts).toBe(1);
      expect(job.lastError).toBe("boom");
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("resets running jobs at start", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "RUNNING" },
    });

    await worker.start();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(handler).toHaveBeenCalledWith(1);
  });

  it("runs a job enqueued after start when woken", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await worker.start();
    setGlobalWorker(worker);

    await enqueue("REFRESH_FEED", 1);
    wakeWorker();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
  });

  it("ignores wake when no worker is registered", () => {
    setGlobalWorker(undefined);
    expect(() => wakeWorker()).not.toThrow();
  });

  it("does nothing unless started", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );

    await enqueue("REFRESH_FEED", 1);
    worker.wake();
    await worker.tick();

    expect(handler).not.toHaveBeenCalled();
    expect(await prisma.job.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/worker.test.ts` Expected: FAIL, cannot
resolve `@/lib/jobs/worker`.

- [ ] **Step 3: Write the worker**

`src/lib/jobs/worker.ts`:

```ts
import { Job, JobKind } from "@/generated/prisma/client";
import { notifyUser } from "@/lib/events/userEvents";
import { CONCURRENCY, POLL_INTERVAL_MS } from "@/lib/jobs/config";
import type { JobHandler } from "@/lib/jobs/handlers";
import {
  claimDueJobs,
  completeJob,
  failJob,
  resetRunningJobs,
} from "@/lib/jobs/jobRepository";
import logger from "@/lib/logger";

interface WorkerOptions {
  pollIntervalMs?: number;
  concurrency?: Record<JobKind, number>;
}

export interface Worker {
  /** Resets leftover running jobs, then starts polling. */
  start: () => Promise<void>;
  stop: () => void;
  /** Tick now instead of at the next poll. Safe to call at any time. */
  wake: () => void;
  /** One pass: claim due jobs up to the free slots and start them. */
  tick: () => Promise<void>;
}

const JOB_KINDS = Object.keys(CONCURRENCY) as JobKind[];

export const createWorker = (
  handlers: Record<JobKind, JobHandler>,
  options: WorkerOptions = {},
): Worker => {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const concurrency = options.concurrency ?? CONCURRENCY;
  const inFlight: Record<JobKind, number> = {
    REFRESH_FEED: 0,
    PROCESS_ARTICLE: 0,
  };

  let running = false;
  let ticking = false;
  let tickRequested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (!running) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => void tick(), pollIntervalMs);
  };

  const run = async (job: Job) => {
    inFlight[job.kind] += 1;
    const context = {
      id: job.id,
      kind: job.kind,
      targetId: job.targetId,
      attempt: job.attempts + 1,
    };
    try {
      const userId = await handlers[job.kind](job.targetId);
      await completeJob(job.id);
      if (userId) {
        notifyUser(userId);
      }
    } catch (error) {
      logger.error({ err: error, job: context }, "Job failed.");
      try {
        const outcome = await failJob(job, error);
        if (outcome === "FAILED") {
          logger.error({ job: context }, "Job gave up after final attempt.");
        }
      } catch (updateError) {
        logger.error(
          { err: updateError, job: context },
          "Could not record job failure.",
        );
      }
    } finally {
      inFlight[job.kind] -= 1;
      // A finished job frees a slot; look for more work right away.
      void tick();
    }
  };

  const tick = async () => {
    if (!running) {
      return;
    }
    // A tick already in progress will look again before it finishes, so a
    // second caller only needs to leave a note.
    if (ticking) {
      tickRequested = true;
      return;
    }

    ticking = true;
    clearTimeout(timer);
    try {
      for (const kind of JOB_KINDS) {
        const free = concurrency[kind] - inFlight[kind];
        const jobs = await claimDueJobs(kind, free);
        for (const job of jobs) {
          void run(job);
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Worker tick failed.");
    } finally {
      ticking = false;
      if (tickRequested) {
        tickRequested = false;
        void tick();
      } else {
        schedule();
      }
    }
  };

  const start = async () => {
    if (running) {
      return;
    }
    running = true;
    const reset = await resetRunningJobs();
    if (reset > 0) {
      logger.warn(
        { count: reset },
        "Requeued jobs left running by a previous process.",
      );
    }
    void tick();
  };

  const stop = () => {
    running = false;
    clearTimeout(timer);
  };

  const wake = () => {
    void tick();
  };

  return { start, stop, wake, tick };
};

/**
 * The worker lives in the instrumentation module graph; server actions that
 * enqueue live in another. `globalThis` is the one thing both share.
 */
const GLOBAL_KEY = "__briefingOfficerWorker";

type GlobalWithWorker = typeof globalThis & { [GLOBAL_KEY]?: Worker };

export const setGlobalWorker = (worker: Worker | undefined) => {
  (globalThis as GlobalWithWorker)[GLOBAL_KEY] = worker;
};

/** Ask the running worker, if any, to look for work now. */
export const wakeWorker = () => {
  (globalThis as GlobalWithWorker)[GLOBAL_KEY]?.wake();
};
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/worker.test.ts` Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobs/worker.ts tests/integration/worker.test.ts
git commit -m "feat: add background worker loop with per-kind concurrency"
```

---

### Task 6: Scheduler

**Files:**

- Create: `src/lib/jobs/scheduler.ts`
- Modify: `src/lib/repository/articleRepository.ts:75-96` (remove
  `deleteArticlesOlderThanXDays`)
- Test: `tests/integration/scheduler.test.ts`

**Interfaces:**

- Consumes: `enqueueIfAbsent`, `deleteStaleFailedJobs` (Task 2); config
  constants (Task 2); `ARTICLE_RETENTION_DAYS` from `@/lib/constants`.
- Produces: `enqueueDueFeedRefreshes(now?: Date): Promise<number>`,
  `enqueueMissingLeads(now?: Date): Promise<number>`,
  `purgeOldArticles(days?: number): Promise<number>`,
  `runCleanup(now?: Date): Promise<void>`,
  `createScheduler(options?: { intervalMs?: number; wake?: () => void }): { start(): void; stop(): void; runOnce(): Promise<void> }`.

- [ ] **Step 1: Remove the purge from the article repository**

Delete `deleteArticlesOlderThanXDays` (the whole function, lines 75-96 of
`src/lib/repository/articleRepository.ts`). Its only caller is the cron route,
which Task 11 deletes. Being in a `"use server"` file it was callable by any
signed-in user with an arbitrary `days` argument; the scheduler owns it now.

- [ ] **Step 2: Write the failing test**

`tests/integration/scheduler.test.ts`:

```ts
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
  it("queues recent unread articles that have no lead", async () => {
    const feed = await createFeed({ userId });
    const missing = await createArticle({ userId, feedId: feed.id });
    const withLead = await createArticle({ userId, feedId: feed.id });
    await prisma.articleLead.create({
      data: { articleId: withLead.id, text: "lead" },
    });
    await createArticle({ userId, feedId: feed.id, status: "READ" });
    const old = await createArticle({ userId, feedId: feed.id });
    await prisma.article.update({
      where: { id: old.id },
      data: { createdAt: daysAgo(2) },
    });

    const queued = await enqueueMissingLeads();

    expect(queued).toBe(1);
    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: "PROCESS_ARTICLE",
      targetId: missing.id,
    });
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/integration/scheduler.test.ts` Expected: FAIL, cannot
resolve `@/lib/jobs/scheduler`.

- [ ] **Step 4: Write the scheduler**

`src/lib/jobs/scheduler.ts`:

```ts
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
  enqueueIfAbsent,
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

  for (const feed of feeds) {
    await enqueueIfAbsent("REFRESH_FEED", feed.id);
  }

  return feeds.length;
};

/**
 * Queues processing for recent inbox articles that still have no lead, which
 * covers leads whose job failed for good. Older ones are left alone.
 */
export const enqueueMissingLeads = async (now = new Date()) => {
  const since = new Date(now.getTime() - MISSING_LEAD_LOOKBACK_MS);
  const articles = await prisma.article.findMany({
    where: { status: "UNREAD", lead: null, createdAt: { gte: since } },
    select: { id: true },
  });

  for (const article of articles) {
    await enqueueIfAbsent("PROCESS_ARTICLE", article.id);
  }

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
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/integration/scheduler.test.ts` Expected: PASS (9
tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/jobs/scheduler.ts src/lib/repository/articleRepository.ts tests/integration/scheduler.test.ts
git commit -m "feat: add scheduler for feed refreshes, lead sweeps, and cleanup"
```

---

### Task 7: Startup wiring

**Files:**

- Create: `src/lib/jobs/start.ts`
- Create: `src/instrumentation.ts`

**Interfaces:**

- Consumes: `createWorker`, `setGlobalWorker` (Task 5); `createScheduler` (Task
  6); `handlers` (Task 4).
- Produces: `startBackgroundWork(): Promise<void>`.

- [ ] **Step 1: Write the starter**

`src/lib/jobs/start.ts`:

```ts
import { handlers } from "@/lib/jobs/handlers";
import { createScheduler } from "@/lib/jobs/scheduler";
import { createWorker, setGlobalWorker, Worker } from "@/lib/jobs/worker";
import logger from "@/lib/logger";

interface BackgroundWork {
  worker: Worker;
  scheduler: ReturnType<typeof createScheduler>;
}

const GLOBAL_KEY = "__briefingOfficerBackgroundWork";

type GlobalWithBackgroundWork = typeof globalThis & {
  [GLOBAL_KEY]?: BackgroundWork;
};

/**
 * Starts the worker and the scheduler. In development the instrumentation
 * hook can run again after a reload, so any previous pair is stopped first.
 * Failures are logged, not thrown: a missing AI provider must not stop the
 * server from serving pages.
 */
export const startBackgroundWork = async () => {
  const global = globalThis as GlobalWithBackgroundWork;

  try {
    global[GLOBAL_KEY]?.scheduler.stop();
    global[GLOBAL_KEY]?.worker.stop();

    const worker = createWorker(handlers);
    setGlobalWorker(worker);
    await worker.start();

    const scheduler = createScheduler({ wake: worker.wake });
    scheduler.start();

    global[GLOBAL_KEY] = { worker, scheduler };
    logger.info("Background worker started.");
  } catch (error) {
    logger.error({ err: error }, "Failed to start background worker.");
  }
};
```

`src/instrumentation.ts`:

```ts
/**
 * Called once per server start. The worker only makes sense in the Node
 * runtime of a running server: not on the edge runtime, not while `next build`
 * prerenders, and not in test runs that seed real feed URLs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  if (process.env.BACKGROUND_WORKER_DISABLED === "true") {
    return;
  }

  const { startBackgroundWork } = await import("@/lib/jobs/start");
  await startBackgroundWork();
}
```

- [ ] **Step 2: Verify the build accepts it**

Run: `npm run typecheck && npm run lint` Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/jobs/start.ts src/instrumentation.ts
git commit -m "feat: start the background worker with the server"
```

---

### Task 8: SSE route

**Files:**

- Create: `src/app/api/events/route.ts`
- Test: `tests/integration/eventsRoute.test.ts`

**Interfaces:**

- Consumes: `subscribe` (Task 3); `auth.api.getSession` from `@/lib/auth`.
- Produces: `GET /api/events` streaming `text/event-stream`.

- [ ] **Step 1: Write the failing test**

`tests/integration/eventsRoute.test.ts`:

```ts
import { notifyUser } from "@/lib/events/userEvents";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { GET } from "@/app/api/events/route";
import { auth } from "@/lib/auth";

const readChunk = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  const { value, done } = await reader.read();
  expect(done).toBe(false);
  return new TextDecoder().decode(value);
};

describe("GET /api/events", () => {
  it("rejects requests without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await GET(new Request("http://localhost/api/events"));

    expect(response.status).toBe(401);
  });

  it("streams a change event for the signed-in user only", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "alice" },
    } as never);
    const controller = new AbortController();
    const response = await GET(
      new Request("http://localhost/api/events", {
        signal: controller.signal,
      }),
    );

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    expect(await readChunk(reader)).toBe(": connected\n\n");

    notifyUser("bob");
    notifyUser("alice");

    expect(await readChunk(reader)).toBe("data: changed\n\n");

    controller.abort();
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/eventsRoute.test.ts` Expected: FAIL,
cannot resolve `@/app/api/events/route`.

- [ ] **Step 3: Write the route**

`src/app/api/events/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { subscribe } from "@/lib/events/userEvents";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 20_000;

/**
 * Server-Sent Events stream. One connection per open tab; each event tells the
 * page that something it shows has changed. The heartbeat keeps proxies from
 * closing an idle connection.
 */
export const GET = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const unsubscribe = subscribe(userId, () => send("data: changed\n\n"));
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      send(": connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/eventsRoute.test.ts` Expected: PASS (2
tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/events/route.ts tests/integration/eventsRoute.test.ts
git commit -m "feat: stream change events to open pages"
```

---

### Task 9: LiveUpdates provider

**Files:**

- Create: `src/components/live-updates.tsx`
- Modify: `src/app/feed/layout.tsx`
- Test: `tests/components/live-updates.test.tsx`

**Interfaces:**

- Produces: `LiveUpdates` (default export, client component with `children`),
  `useLiveUpdates(): { userRefreshActive: boolean; noteUserRefresh: () => void }`,
  `LiveUpdatesContext` (named export, for tests), `USER_REFRESH_WINDOW_MS`.

- [ ] **Step 1: Write the failing test**

`tests/components/live-updates.test.tsx`:

```tsx
import LiveUpdates, {
  useLiveUpdates,
  USER_REFRESH_WINDOW_MS,
} from "@/components/live-updates";
import { act, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  emit() {
    this.onmessage?.(new MessageEvent("message", { data: "changed" }));
  }
}

const refresh = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.mocked(useRouter).mockReturnValue({ refresh } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const Probe = () => {
  const { userRefreshActive, noteUserRefresh } = useLiveUpdates();
  return (
    <button onClick={noteUserRefresh}>
      {userRefreshActive ? "active" : "idle"}
    </button>
  );
};

describe("LiveUpdates", () => {
  it("opens one stream to /api/events and closes it on unmount", () => {
    const { unmount } = render(<LiveUpdates>x</LiveUpdates>);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/events");

    unmount();
    expect(FakeEventSource.instances[0].close).toHaveBeenCalledOnce();
  });

  it("refreshes the router on a message, throttled with a trailing call", () => {
    render(<LiveUpdates>x</LiveUpdates>);
    const [source] = FakeEventSource.instances;

    act(() => source.emit());
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(500);
      source.emit();
      source.emit();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("reports a user refresh as active for a while, then idle", async () => {
    render(
      <LiveUpdates>
        <Probe />
      </LiveUpdates>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("idle");

    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByRole("button")).toHaveTextContent("active");

    act(() => {
      vi.advanceTimersByTime(USER_REFRESH_WINDOW_MS);
    });
    expect(screen.getByRole("button")).toHaveTextContent("idle");
  });

  it("is inert outside a provider", () => {
    render(<Probe />);
    expect(screen.getByRole("button")).toHaveTextContent("idle");
    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByRole("button")).toHaveTextContent("idle");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
`npx vitest run --project components tests/components/live-updates.test.tsx`
Expected: FAIL, cannot resolve `@/components/live-updates`.

- [ ] **Step 3: Write the provider**

`src/components/live-updates.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const REFRESH_THROTTLE_MS = 2_000;

/** How long after the reader presses Refresh new articles merge in on their own. */
export const USER_REFRESH_WINDOW_MS = 5 * 60_000;

interface LiveUpdatesContextValue {
  /** True for a short while after the reader asked for a refresh themselves. */
  userRefreshActive: boolean;
  noteUserRefresh: () => void;
}

export const LiveUpdatesContext = createContext<LiveUpdatesContextValue>({
  userRefreshActive: false,
  noteUserRefresh: () => {},
});

export const useLiveUpdates = () => useContext(LiveUpdatesContext);

/**
 * Keeps the page in step with the background worker. Every "changed" event
 * from /api/events re-renders the server components through
 * `router.refresh()`, throttled so a burst of finished jobs costs one refresh
 * every two seconds and the last event is never dropped.
 */
const LiveUpdates = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [userRefreshActive, setUserRefreshActive] = useState(false);
  const windowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const noteUserRefresh = useCallback(() => {
    setUserRefreshActive(true);
    clearTimeout(windowTimer.current);
    windowTimer.current = setTimeout(
      () => setUserRefreshActive(false),
      USER_REFRESH_WINDOW_MS,
    );
  }, []);

  useEffect(() => () => clearTimeout(windowTimer.current), []);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    let lastRefreshAt = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      lastRefreshAt = Date.now();
      trailing = undefined;
      router.refresh();
    };

    const source = new EventSource("/api/events");
    source.onmessage = () => {
      const elapsed = Date.now() - lastRefreshAt;
      if (elapsed >= REFRESH_THROTTLE_MS) {
        refresh();
      } else if (!trailing) {
        trailing = setTimeout(refresh, REFRESH_THROTTLE_MS - elapsed);
      }
    };

    return () => {
      source.close();
      clearTimeout(trailing);
    };
  }, [router]);

  const value = useMemo(
    () => ({ userRefreshActive, noteUserRefresh }),
    [userRefreshActive, noteUserRefresh],
  );

  return (
    <LiveUpdatesContext.Provider value={value}>
      {children}
    </LiveUpdatesContext.Provider>
  );
};

export default LiveUpdates;
```

- [ ] **Step 4: Run the test**

Run:
`npx vitest run --project components tests/components/live-updates.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Mount it in the feed layout**

`src/app/feed/layout.tsx`:

```tsx
import LiveUpdates from "@/components/live-updates";
import LeftNavigation from "@/components/navigation/left-navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function MyFeedsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <LeftNavigation />

      <div className="w-full">
        <LiveUpdates>{children}</LiveUpdates>
      </div>
    </SidebarProvider>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/live-updates.tsx src/app/feed/layout.tsx tests/components/live-updates.test.tsx
git commit -m "feat: refresh open feed pages when background work finishes"
```

---

### Task 10: Article list holds new articles

**Files:**

- Modify: `src/components/article/article-list.tsx`
- Modify: `src/components/article/article-card.tsx` (drop client-side lead
  generation)
- Modify: `src/app/feed/[feedId]/page.tsx` (`key` on the list)
- Test: `tests/components/article/article-list.test.tsx`

**Interfaces:**

- Consumes: `useLiveUpdates`, `LiveUpdatesContext` (Task 9).
- Produces: unchanged `ArticleList` props.

- [ ] **Step 1: Write the failing test**

`tests/components/article/article-list.test.tsx`:

```tsx
import ArticleList from "@/components/article/article-list";
import { LiveUpdatesContext } from "@/components/live-updates";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn(),
  markArticleAsReadLater: vi.fn(),
  markArticleAsStarred: vi.fn(),
  markArticleAsNotInteresting: vi.fn(),
  restoreArticleStatus: vi.fn(),
  restoreArticleToInbox: vi.fn(),
  unmarkArticleAsReadLater: vi.fn(),
  unmarkArticleAsStarred: vi.fn(),
}));

const article = (id: number, title = `Article ${id}`) =>
  ({
    id,
    title,
    link: `https://example.com/${id}`,
    publicationDate: new Date("2026-09-01T00:00:00Z"),
    status: "UNREAD",
    starred: false,
    filterReason: null,
    feedId: 1,
    feed: { id: 1, title: "Feed" },
    lead: { text: `Lead ${id}` },
    scrape: { textContent: "body", author: "" },
  }) as any;

describe("ArticleList", () => {
  it("shows every article it mounts with", () => {
    render(<ArticleList articles={[article(1), article(2)]} />);

    expect(screen.getByText("Article 1")).toBeInTheDocument();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("holds back articles that arrive later and counts them", () => {
    const { rerender } = render(<ArticleList articles={[article(2)]} />);

    rerender(<ArticleList articles={[article(3), article(2)]} />);

    expect(screen.queryByText("Article 3")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show 1 new article" }),
    ).toBeInTheDocument();

    rerender(<ArticleList articles={[article(4), article(3), article(2)]} />);
    expect(
      screen.getByRole("button", { name: "Show 2 new articles" }),
    ).toBeInTheDocument();
  });

  it("merges held articles in server order when the button is clicked", async () => {
    const { rerender } = render(<ArticleList articles={[article(2)]} />);
    rerender(<ArticleList articles={[article(3), article(2)]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Show 1 new article" }),
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Article 3",
      "Article 2",
    ]);
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("updates an article already on screen in place", () => {
    const { rerender } = render(<ArticleList articles={[article(1)]} />);

    rerender(<ArticleList articles={[article(1, "Article 1 (updated)")]} />);

    expect(screen.getByText("Article 1 (updated)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("drops an article the server no longer returns", () => {
    const { rerender } = render(
      <ArticleList articles={[article(1), article(2)]} />,
    );

    rerender(<ArticleList articles={[article(2)]} />);

    expect(screen.queryByText("Article 1")).toBeNull();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
  });

  it("merges new articles at once while a user refresh is active", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LiveUpdatesContext.Provider
        value={{ userRefreshActive: true, noteUserRefresh: () => {} }}
      >
        {children}
      </LiveUpdatesContext.Provider>
    );
    const { rerender } = render(<ArticleList articles={[article(2)]} />, {
      wrapper,
    });

    rerender(<ArticleList articles={[article(3), article(2)]} />);

    expect(screen.getByText("Article 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
`npx vitest run --project components tests/components/article/article-list.test.tsx`
Expected: FAIL on "holds back articles" (Article 3 is rendered, no button).

- [ ] **Step 3: Rewrite the list**

`src/components/article/article-list.tsx`:

```tsx
"use client";

import ArticleCard from "@/components/article/article-card";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { Prisma } from "@/generated/prisma/client";
import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type ListedArticle = Prisma.ArticleGetPayload<{
  include: { feed: true; lead: true; scrape: true };
}>;

interface ArticleListProps {
  articles: ListedArticle[];
}

const idsOf = (articles: ListedArticle[]) =>
  articles.map((article) => article.id);

/**
 * Renders the articles it has already shown and holds the rest behind a
 * "Show N new articles" button, so a live refresh never pushes the list
 * around under the reader. Articles already on screen still update in place
 * and disappear when the server stops returning them.
 */
const ArticleList = ({ articles }: ArticleListProps) => {
  const { userRefreshActive } = useLiveUpdates();
  const [selectedArticle, setSelectedArticle] = useState<number>();
  const [seenIds, setSeenIds] = useState(() => new Set(idsOf(articles)));

  const unseen = articles.filter((article) => !seenIds.has(article.id));

  // The reader asked for this refresh, so its articles are what they want to
  // see. Adjusting state during render is React's pattern for deriving state
  // from a prop change without a flash of the intermediate render.
  if (userRefreshActive && unseen.length > 0) {
    setSeenIds(new Set([...seenIds, ...idsOf(unseen)]));
  }

  const visible = articles.filter((article) => seenIds.has(article.id));
  const heldCount = articles.length - visible.length;

  const showNewArticles = () => {
    setSeenIds(new Set([...seenIds, ...idsOf(articles)]));
  };

  useHotkeys("p", () => {
    if (selectedArticle === undefined) {
      return;
    }

    if (selectedArticle === 0) {
      setSelectedArticle(undefined);
      return;
    }

    setSelectedArticle(selectedArticle - 1);
  });

  useHotkeys("n", () => {
    if (selectedArticle === undefined) {
      setSelectedArticle(0);
      return;
    }

    if (selectedArticle === visible.length - 1) {
      return;
    }

    setSelectedArticle(selectedArticle + 1);
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-6">
      {heldCount > 0 && (
        <Button
          className="cursor-pointer self-center"
          onClick={showNewArticles}
          variant="outline"
        >
          <ArrowUpIcon className="size-4" />
          Show {heldCount} new {heldCount === 1 ? "article" : "articles"}
        </Button>
      )}

      {visible.map((article, index) => (
        <ArticleCard
          key={article.id}
          article={article}
          onClick={() => setSelectedArticle(index)}
          selected={index === selectedArticle}
        />
      ))}
    </div>
  );
};

export default ArticleList;
```

- [ ] **Step 4: Drop client-side lead generation from the card**

In `src/components/article/article-card.tsx`:

Remove the imports of `generateAiLead` and of `useEffect, useState` (keep
nothing from `react`, the file no longer needs it), and replace

```tsx
const [aiLead, setAiLead] = useState(props.article.lead?.text);

useEffect(() => {
  if (!props.article.lead && props.article.scrape?.textContent) {
    generateAiLead(props.article.id).then((lead) => setAiLead(lead));
  }
}, [props.article]);
```

with

```tsx
// Leads are generated by the background worker; the page re-renders when
// one lands, so the card only ever shows what the server sent.
const aiLead = props.article.lead?.text;
```

- [ ] **Step 5: Key the list on the feed page**

In `src/app/feed/[feedId]/page.tsx`, change

```tsx
<ArticleList articles={articles} />
```

to

```tsx
<ArticleList key={showSearchParam} articles={articles} />
```

so switching between Unread, All, and Filtered remounts the list rather than
presenting the other view's articles as new.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run --project components` Expected: PASS, including the 6 new
list tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/article/article-list.tsx src/components/article/article-card.tsx "src/app/feed/[feedId]/page.tsx" tests/components/article/article-list.test.tsx
git commit -m "feat: announce new articles instead of inserting them into the open list"
```

---

### Task 11: Refresh actions enqueue

**Files:**

- Modify: `src/lib/repository/feedRepository.ts`
- Modify: `src/app/feed/refresh-all-feeds-button.tsx`
- Modify: `src/app/feed/[feedId]/refresh-feed-button.tsx`
- Modify: `src/app/feed/category/[categoryId]/refresh-category-button.tsx`
- Modify: `tests/integration/feedRepository.test.ts`
- Test: `tests/components/feed/refresh-buttons.test.tsx`

**Interfaces:**

- Consumes: `enqueue` (Task 2), `wakeWorker` (Task 5), `useLiveUpdates` (Task
  9).
- Produces: `refreshFeed(feedId)`, `refreshFeeds()`,
  `refreshCategoryFeeds(categoryId)` now resolve once jobs are queued.

- [ ] **Step 1: Update the repository test**

In `tests/integration/feedRepository.test.ts`:

Remove the `vi.mock` blocks for `@/lib/scraper` and
`@/lib/ai/services/leadService`, the imports of `generateAiLead`,
`scrapeArticle`, `scrapeFeed`, and `Feed`, the `feedItem` helper, and the three
`vi.mocked(...)` lines for them in `beforeEach`. Then replace the
`feedRepository.refreshFeed`, `feedRepository.refreshFeeds`, and
`feedRepository.refreshCategoryFeeds` describe blocks with:

```ts
const queuedRefreshes = async () =>
  (
    await prisma.job.findMany({
      where: { kind: "REFRESH_FEED" },
      orderBy: { targetId: "asc" },
    })
  ).map((job) => job.targetId);

describe("feedRepository.refreshFeed", () => {
  it("queues a refresh job for the reader's feed and returns at once", async () => {
    const feed = await createFeed({ userId, autoRefresh: false });

    await refreshFeed(feed.id);

    expect(await queuedRefreshes()).toEqual([feed.id]);
    const untouched = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(untouched.lastFetched.getTime()).toBe(0);
  });

  it("refuses a feed that belongs to someone else", async () => {
    const other = await createUser();
    const feed = await createFeed({ userId: other.id });

    await expect(refreshFeed(feed.id)).rejects.toThrow("Feed not found");
    expect(await prisma.job.count()).toBe(0);
  });
});

describe("feedRepository.refreshFeeds", () => {
  it("queues only the reader's auto-refresh feeds", async () => {
    const autoRefreshed = await createFeed({
      userId,
      autoRefresh: true,
      link: "https://example.com/on.xml",
    });
    await createFeed({
      userId,
      autoRefresh: false,
      link: "https://example.com/off.xml",
    });
    const other = await createUser();
    await createFeed({ userId: other.id, autoRefresh: true });

    await refreshFeeds();

    expect(await queuedRefreshes()).toEqual([autoRefreshed.id]);
  });
});

describe("feedRepository.refreshCategoryFeeds", () => {
  it("queues only auto-refresh feeds in the given category", async () => {
    const category = await createCategory({ userId, name: "Tech" });
    const inCategoryEnabled = await createFeed({
      userId,
      autoRefresh: true,
      feedCategoryId: category.id,
      link: "https://example.com/cat-on.xml",
    });
    await createFeed({
      userId,
      autoRefresh: false,
      feedCategoryId: category.id,
      link: "https://example.com/cat-off.xml",
    });
    await createFeed({
      userId,
      autoRefresh: true,
      feedCategoryId: null,
      link: "https://example.com/no-cat.xml",
    });

    await refreshCategoryFeeds(category.id);

    expect(await queuedRefreshes()).toEqual([inCategoryEnabled.id]);
  });
});
```

In the `feedRepository.createFeed` test, replace
`expect(vi.mocked(scrapeFeed)).toHaveBeenCalled();` with
`expect(await queuedRefreshes()).toEqual([created.id]);` and remove the
`vi.mocked(scrapeFeed).mockResolvedValue([]);` lines from that test, the
`updateFeed` test, and the "writes exactly the disinterests" test. In the
`updateFeed` test add `expect(await queuedRefreshes()).toEqual([feed.id]);`
after the field assertions.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/integration/feedRepository.test.ts` Expected: FAIL:
refresh tests find no jobs (the actions still process inline).

- [ ] **Step 3: Rewrite the refresh actions**

In `src/lib/repository/feedRepository.ts`:

Replace the imports of `generateAiLead`, `scrapeArticle, scrapeFeed`, and the
`Article, Feed` type imports with:

```ts
import { FeedFilterKind, Prisma } from "@/generated/prisma/client";
import { enqueue } from "@/lib/jobs/jobRepository";
import { wakeWorker } from "@/lib/jobs/worker";
```

(keep the other existing imports). Delete `processArticle`, the old
`refreshFeed`, `refreshCategoryFeeds`, `refreshFeeds`, and
`updateLastFetchedToNow`, and add in their place:

```ts
/**
 * Queues a fetch of one feed. The reader asked, so `autoRefresh` does not
 * matter here. The worker picks the job up within milliseconds; open pages
 * learn about new articles over the event stream.
 */
export const refreshFeed = async (feedId: number) => {
  const userId = await getUserId();
  const feed = await prisma.feed.findFirst({
    where: { id: feedId, userId },
    select: { id: true },
  });
  if (!feed) {
    throw new Error("Feed not found");
  }

  await enqueue("REFRESH_FEED", feed.id);
  wakeWorker();
};

const queueRefreshes = async (where: Prisma.FeedWhereInput) => {
  const feeds = await prisma.feed.findMany({
    where: { ...where, autoRefresh: true },
    select: { id: true },
  });

  for (const feed of feeds) {
    await enqueue("REFRESH_FEED", feed.id);
  }
  wakeWorker();
};

export const refreshCategoryFeeds = async (categoryId: number) => {
  const userId = await getUserId();
  await queueRefreshes({ userId, feedCategoryId: categoryId });
};

export const refreshFeeds = async () => {
  const userId = await getUserId();
  await queueRefreshes({ userId });
};
```

`createFeed` and `updateFeed` keep their `await refreshFeed(...)` calls.

- [ ] **Step 4: Run the repository tests**

Run: `npx vitest run tests/integration/feedRepository.test.ts` Expected: PASS.

- [ ] **Step 5: Write the failing button test**

`tests/components/feed/refresh-buttons.test.tsx`:

```tsx
import RefreshFeedButton from "@/app/feed/[feedId]/refresh-feed-button";
import RefreshCategoryButton from "@/app/feed/category/[categoryId]/refresh-category-button";
import RefreshAllFeedsButton from "@/app/feed/refresh-all-feeds-button";
import { LiveUpdatesContext } from "@/components/live-updates";
import {
  refreshCategoryFeeds,
  refreshFeed,
  refreshFeeds,
} from "@/lib/repository/feedRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/feedRepository", () => ({
  refreshFeed: vi.fn().mockResolvedValue(undefined),
  refreshFeeds: vi.fn().mockResolvedValue(undefined),
  refreshCategoryFeeds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { message: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const noteUserRefresh = vi.fn();

const renderWithContext = (ui: React.ReactElement) =>
  render(
    <LiveUpdatesContext.Provider
      value={{ userRefreshActive: false, noteUserRefresh }}
    >
      {ui}
    </LiveUpdatesContext.Provider>,
  );

const STARTED = "Refresh started. New articles will appear as they arrive.";

describe("refresh buttons", () => {
  it("Refresh all queues every feed and notes the user refresh", async () => {
    renderWithContext(<RefreshAllFeedsButton />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshFeeds).toHaveBeenCalledOnce();
    expect(toast.message).toHaveBeenCalledWith(STARTED);
    expect(noteUserRefresh).toHaveBeenCalledOnce();
  });

  it("Refresh feed queues that feed and notes the user refresh", async () => {
    renderWithContext(<RefreshFeedButton feedId={7} />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshFeed).toHaveBeenCalledWith(7);
    expect(toast.message).toHaveBeenCalledWith(STARTED);
    expect(noteUserRefresh).toHaveBeenCalledOnce();
  });

  it("Refresh category queues that category and notes the user refresh", async () => {
    renderWithContext(<RefreshCategoryButton categoryId={3} />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshCategoryFeeds).toHaveBeenCalledWith(3);
    expect(toast.message).toHaveBeenCalledWith(STARTED);
    expect(noteUserRefresh).toHaveBeenCalledOnce();
  });

  it("shows an error and does not note a user refresh when queuing fails", async () => {
    vi.mocked(refreshFeed).mockRejectedValueOnce(new Error("nope"));
    renderWithContext(<RefreshFeedButton feedId={7} />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(toast.error).toHaveBeenCalled();
    expect(toast.message).not.toHaveBeenCalled();
    expect(noteUserRefresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run:
`npx vitest run --project components tests/components/feed/refresh-buttons.test.tsx`
Expected: FAIL: old toast copy, `noteUserRefresh` never called.

- [ ] **Step 7: Rewrite the three buttons**

`src/app/feed/refresh-all-feeds-button.tsx`:

```tsx
"use client";

import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { refreshFeeds } from "@/lib/repository/feedRepository";
import { LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const REFRESH_STARTED_MESSAGE =
  "Refresh started. New articles will appear as they arrive.";

const RefreshAllFeedsButton = () => {
  const { noteUserRefresh } = useLiveUpdates();
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleClick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshFeeds();
    } catch {
      toast.error("An error occurred refreshing your feeds.", {
        description: "Please check the server logs to find out more.",
        action: {
          label: "Try again",
          onClick: () => handleClick(),
        },
      });
      setRefreshInProgress(false);
      return;
    }
    setRefreshInProgress(false);

    noteUserRefresh();
    toast.message(REFRESH_STARTED_MESSAGE);
  };

  return (
    <Button
      className="cursor-pointer"
      disabled={refreshInProgress}
      onClick={handleClick}
      variant="outline"
    >
      {refreshInProgress ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <RotateCwIcon className="size-4" />
      )}
      <span className="truncate">Refresh</span>
    </Button>
  );
};

export default RefreshAllFeedsButton;
```

`src/app/feed/[feedId]/refresh-feed-button.tsx`:

```tsx
"use client";

import { REFRESH_STARTED_MESSAGE } from "@/app/feed/refresh-all-feeds-button";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { refreshFeed } from "@/lib/repository/feedRepository";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const { noteUserRefresh } = useLiveUpdates();
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleClick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshFeed(feedId);
      noteUserRefresh();
      toast.message(REFRESH_STARTED_MESSAGE);
    } catch {
      toast.error("An error occurred refreshing this feed.", {
        description: "Please check the server logs to learn more.",
      });
    } finally {
      setRefreshInProgress(false);
    }
  };

  return (
    <Button
      className="cursor-pointer"
      disabled={refreshInProgress}
      onClick={handleClick}
      variant="outline"
    >
      {refreshInProgress ? (
        <LoaderCircle className="mr-2 size-4 animate-spin" />
      ) : (
        <RotateCw className="mr-2 size-4" />
      )}
      Refresh
    </Button>
  );
};

export default RefreshFeedButton;
```

`src/app/feed/category/[categoryId]/refresh-category-button.tsx`:

```tsx
"use client";

import { REFRESH_STARTED_MESSAGE } from "@/app/feed/refresh-all-feeds-button";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { refreshCategoryFeeds } from "@/lib/repository/feedRepository";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RefreshCategoryButtonProps {
  categoryId: number;
}

const RefreshCategoryButton = ({ categoryId }: RefreshCategoryButtonProps) => {
  const { noteUserRefresh } = useLiveUpdates();
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleClick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshCategoryFeeds(categoryId);
      noteUserRefresh();
      toast.message(REFRESH_STARTED_MESSAGE);
    } catch {
      toast.error("An error occurred refreshing this category.", {
        description: "Please check the server logs to learn more.",
      });
    } finally {
      setRefreshInProgress(false);
    }
  };

  return (
    <Button
      className="cursor-pointer"
      disabled={refreshInProgress}
      onClick={handleClick}
      variant="outline"
    >
      {refreshInProgress ? (
        <LoaderCircle className="mr-2 size-4 animate-spin" />
      ) : (
        <RotateCw className="mr-2 size-4" />
      )}
      Refresh
    </Button>
  );
};

export default RefreshCategoryButton;
```

- [ ] **Step 8: Run everything**

Run: `npm run typecheck && npm test` Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/repository/feedRepository.ts src/app/feed/refresh-all-feeds-button.tsx "src/app/feed/[feedId]/refresh-feed-button.tsx" "src/app/feed/category/[categoryId]/refresh-category-button.tsx" tests/integration/feedRepository.test.ts tests/components/feed/refresh-buttons.test.tsx
git commit -m "feat: refresh feeds in the background instead of blocking the page"
```

---

### Task 12: Remove the cron endpoint and document the new variables

**Files:**

- Delete: `src/app/api/cron/route.ts`
- Delete: `helm-chart/templates/cronjob.yaml`
- Modify: `helm-chart/templates/networkpolicy.yaml` (drop the second policy)
- Modify: `Containerfile`, `.env.example`, `README.md`
- Modify: `playwright.config.ts`, `playwright.screenshots.config.ts`

- [ ] **Step 1: Delete the cron pieces**

```bash
git rm src/app/api/cron/route.ts helm-chart/templates/cronjob.yaml
```

In `helm-chart/templates/networkpolicy.yaml` delete everything from the `---`
separator through the end of the cronjob `NetworkPolicy`, leaving the closing
`{{- end }}` after the app policy's `ingress` block.

In `Containerfile` delete the line
`ENV CRON_API_TOKEN="any-value-will-do-at-build-time"`.

In `.env.example` replace the `CRON_API_TOKEN=...` line with:

```
# Minutes between automatic feed refreshes. Defaults to 15.
#FEED_REFRESH_INTERVAL_MINUTES=15
# Set to true to run the web app without the background worker.
#BACKGROUND_WORKER_DISABLED=true
```

- [ ] **Step 2: Update the README**

Remove the line `-e CRON_API_TOKEN=something-else-random \` from the
`docker run` example. Replace the Application table with:

```markdown
| Environment Variable            | Description                                                           | Default |
| ------------------------------- | --------------------------------------------------------------------- | ------- |
| `DATABASE_URL`                  | URL to the SQLite database.                                           |         |
| `FEED_REFRESH_INTERVAL_MINUTES` | Minutes between automatic feed refreshes.                             | `15`    |
| `BACKGROUND_WORKER_DISABLED`    | Set to `true` to serve pages without refreshing feeds or summarising. | `false` |
```

Add directly below the table:

```markdown
Feeds are refreshed, articles scraped, and summaries generated by a background
worker inside the application process. No external cron job is needed.
```

- [ ] **Step 3: Keep test servers from fetching real feeds**

In `playwright.config.ts`, inside `webServer.env`, add
`BACKGROUND_WORKER_DISABLED: "true",`. Do the same in
`playwright.screenshots.config.ts`.

- [ ] **Step 4: Verify**

Run:
`grep -rn "CRON_API_TOKEN\|api/cron" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs .`
Expected: no output.

Run: `npm run lint && npm run typecheck && npm run build` Expected: no errors;
the build log shows no `/api/cron` route.

- [ ] **Step 5: Commit**

```bash
git add -A Containerfile .env.example README.md helm-chart playwright.config.ts playwright.screenshots.config.ts src/app/api
git commit -m "feat: refresh feeds on a schedule without an external cron job

The /api/cron endpoint, CRON_API_TOKEN, and the Helm CronJob are gone. The
application refreshes feeds itself every FEED_REFRESH_INTERVAL_MINUTES
(default 15). Operators who configured their own external trigger can remove
it."
```

---

### Task 13: Product requirements document

**Files:**

- Modify: `docs/prd.md`

- [ ] **Step 1: Update the PRD**

In section 3, Goals, change
`- Stay simple to self-host: one container, one database file, one cron call.`
to
`- Stay simple to self-host: one container, one database file, no external trigger.`

In section 4, feature 1, append after "The sidebar shows unread counts per
feed.":
`Refreshes run in the background; open pages update themselves as leads arrive and offer a "Show N new articles" button when new articles land.`

In section 5, "Operator setup", replace
`Schedule a call to the cron endpoint every 15 minutes.` with
`Feeds refresh on their own every 15 minutes by default.` and drop
`and a cron token` from the list of what to run the container with.

In section 6, replace
`- Articles older than 365 days are purged on each cron run, except starred and read-later articles.`
with
`- Articles older than 365 days are purged hourly by the background worker, except starred and read-later articles.`
and replace
`- Storage is SQLite. Refresh is driven externally via a token-protected cron endpoint. Liveness and readiness endpoints exist for Kubernetes probes.`
with
`- Storage is SQLite. A background worker in the application process refreshes feeds, scrapes articles, and generates leads from a job table in the same database, with bounded concurrency and retries. Open pages are told about finished work over Server-Sent Events. Liveness and readiness endpoints exist for Kubernetes probes.`

In section 7 add:
`- Failed background jobs are visible only in the database and the logs; there is no admin view of them yet.`

Update the "Last updated" line in the header to the current date.

- [ ] **Step 2: Format and commit**

```bash
npm run format
git add docs/prd.md
git commit -m "docs: describe background processing and live updates in the PRD"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run every CI gate**

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all pass.

- [ ] **Step 2: Smoke-test the running app**

Run `npm run dev` in the background, sign in, open the inbox, press Refresh.
Expected: toast "Refresh started…" at once; server log shows "Background worker
started." and "Feed refreshed."; the page updates without a manual reload. Open
the same page in a second tab, press Refresh in the first; the second tab shows
"Show N new articles" if new articles arrived.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/background-jobs
gh pr create --title "feat: process feeds in the background and update open pages live" --body-file <(...)
```
