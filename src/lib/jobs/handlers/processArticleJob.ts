import { generateAiLead } from "@/lib/ai/services/leadService";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { scrapeArticle } from "@/lib/scraper";
import { indexArticle } from "@/lib/search/articleIndexing";

/**
 * Scrapes the article unless a scrape already exists, then generates its lead
 * and filter verdict, then adds it to the search index. A scrape failure is
 * logged and the lead is generated from the title alone; a lead
 * failure fails the job so it is retried. Resolves to the owning user's id,
 * or null when the article is gone.
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

  // Not allowed to fail the job: a retry would regenerate and re-bill the
  // lead. The next syncSearchIndex picks up an article missing here.
  try {
    await indexArticle(article.id);
  } catch (error) {
    logger.error(
      { err: error, article: { id: article.id } },
      "Failed to index article for search.",
    );
  }

  return article.userId;
};
