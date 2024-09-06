import logger from "@/lib/logger";
import { refreshFeeds } from "@/lib/repository/feedRepository";

const apiKey = "hardcoded-api-keys-are-a-terrible-idea"; // TODO

export const POST = async (request: Request) => {
  if (request.headers.get("X-API-KEY") !== apiKey) {
    return new Response("", { status: 401 });
  }

  refreshFeeds()
    .then(() => logger.debug("Cron finished successfully."))
    .catch((error) => logger.error({ error }, "Cron failed."));

  return new Response("", { status: 200 });
};
