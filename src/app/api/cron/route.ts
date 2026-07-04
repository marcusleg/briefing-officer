import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import logger from "@/lib/logger";
import { deleteArticlesOlderThanXDays } from "@/lib/repository/articleRepository";
import { refreshFeeds } from "@/lib/repository/feedRepository";

const apiKey = process.env.CRON_API_TOKEN;

export const POST = async (request: Request) => {
  if (!apiKey) {
    return new Response("Cronjob API Token is not set.", { status: 500 });
  }

  if (request.headers.get("X-API-KEY") !== apiKey) {
    return new Response("", { status: 401 });
  }

  logger.debug("Cron triggered.");
  const startedAt = Date.now();

  refreshFeeds()
    .then(() =>
      logger.info(
        { durationMs: Date.now() - startedAt },
        "Cron finished: feeds refreshed.",
      ),
    )
    .catch((error) =>
      logger.error({ err: error }, "Cron failed: refreshing feeds threw."),
    );

  deleteArticlesOlderThanXDays(ARTICLE_RETENTION_DAYS).catch((error) =>
    logger.error({ err: error }, "Cron failed: deleting old articles threw."),
  );

  return new Response("", { status: 200 });
};
