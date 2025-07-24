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

  refreshFeeds()
    .then(() => logger.debug("Cron finished successfully."))
    .catch((error) => logger.error({ error }, "Cron failed."));

  void deleteArticlesOlderThanXDays(ARTICLE_RETENTION_DAYS);

  return new Response("", { status: 200 });
};
