import { JobKind } from "@/generated/prisma/client";
import { processArticleJob } from "@/lib/jobs/handlers/processArticleJob";
import { refreshFeedJob } from "@/lib/jobs/handlers/refreshFeedJob";

/** Resolves to the owning user's id, or null when the target no longer exists. */
export type JobHandler = (targetId: number) => Promise<string | null>;

export const handlers: Record<JobKind, JobHandler> = {
  REFRESH_FEED: refreshFeedJob,
  PROCESS_ARTICLE: processArticleJob,
};
