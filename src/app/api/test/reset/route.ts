import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";

const environment = process.env.NODE_ENV;

export const POST = async () => {
  if (!["development", "test"].includes(environment)) {
    return new Response("", { status: 404 });
  }

  logger.debug({}, "Clearing database...");

  try {
    await Promise.all([
      prisma.account.deleteMany(),
      prisma.article.deleteMany(),
      prisma.articleAiTexts.deleteMany(),
      prisma.articleScrape.deleteMany(),
      prisma.feed.deleteMany(),
      prisma.session.deleteMany(),
      prisma.user.deleteMany(),
      prisma.verification.deleteMany(),
    ]);
  } catch (error) {
    let message = "Failed to clear the database.";
    logger.error({ error }, message);
    return Response.json({ message }, { status: 500 });
  }

  const message = "Database cleared successfully.";
  logger.info("Database cleared successfully.");

  return Response.json({ message }, { status: 200 });
};
