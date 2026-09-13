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
