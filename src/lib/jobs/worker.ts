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
