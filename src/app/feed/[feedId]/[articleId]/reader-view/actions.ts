"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";

interface ScrapeArticleOptions {
  forceScrape: boolean;
}

const defaultScrapeArticleOptions: ScrapeArticleOptions = {
  forceScrape: false,
};

export const scrapeArticle = async (
  articleId: number,
  articleLink: string,
  options?: ScrapeArticleOptions,
) => {
  const mergedOptions = { ...defaultScrapeArticleOptions, ...options };

  if (!mergedOptions.forceScrape) {
    const scrape = await prisma.articleScrape.findUnique({
      where: { articleId: articleId },
    });

    if (scrape) {
      return scrape;
    }
  }

  const website = await axios.get(articleLink);
  const cleanBody = DOMPurify.sanitize(website.data);
  const document = new JSDOM(cleanBody);
  const parsedArticle = new Readability(document.window.document).parse();

  if (!parsedArticle) {
    throw new Error("Failed to parse article");
  }

  const scrape = prisma.articleScrape.upsert({
    where: { articleId: articleId },
    create: {
      article: {
        connect: { id: articleId },
      },
      htmlContent: parsedArticle.content,
      textContent: parsedArticle.textContent,
      author: parsedArticle.byline ?? "",
    },
    update: {
      htmlContent: parsedArticle.content,
      textContent: parsedArticle.textContent,
      author: parsedArticle.byline ?? "",
    },
  });

  logger.info(
    {
      article: { id: articleId, link: articleLink },
    },
    "Scraped article.",
  );

  return scrape;
};
