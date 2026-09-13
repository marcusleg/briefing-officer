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
