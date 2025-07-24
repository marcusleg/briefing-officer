import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import logger from "@/lib/logger";
import { deleteArticlesOlderThanXDays } from "@/lib/repository/articleRepository";
import { refreshFeeds } from "@/lib/repository/feedRepository";

const apiKey = "hardcoded-api-keys-are-a-terrible-idea"; // TODO

export const POST = async (request: Request) => {
  if (request.headers.get("X-API-KEY") !== apiKey) {
    return new Response("", { status: 401 });
  }

  refreshFeeds()
    .then(() => logger.debug("Cron finished successfully."))
    .catch((error) => logger.error({ error }, "Cron failed."));

  void deleteArticlesOlderThanXDays(ARTICLE_RETENTION_DAYS);

  return new Response("", { status: 200 });
};
