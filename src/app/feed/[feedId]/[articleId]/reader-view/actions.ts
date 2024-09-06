"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";

interface GetReadabilityOptions {
  forceScrape: boolean;
}

const defaultGetReadabilityOptions: GetReadabilityOptions = {
  forceScrape: false,
};

export const getReadability = async (
  articleId: number,
  articleLink: string,
  options?: GetReadabilityOptions,
) => {
  const mergedOptions = { ...defaultGetReadabilityOptions, ...options };

  if (!mergedOptions.forceScrape) {
    const readability = await prisma.articleReadability.findUnique({
      where: { articleId: articleId },
    });

    if (readability) {
      return readability;
    }
  }

  const website = await axios.get(articleLink);
  const cleanBody = DOMPurify.sanitize(website.data);
  const document = new JSDOM(cleanBody);
  const parsedArticle = new Readability(document.window.document).parse();

  if (!parsedArticle) {
    throw new Error("Failed to parse article");
  }

  const readability = prisma.articleReadability.upsert({
    where: { articleId: articleId },
    create: {
      article: {
        connect: { id: articleId },
      },
      content: parsedArticle.content,
      textContent: parsedArticle.textContent,
      byLine: parsedArticle.byline ?? "",
    },
    update: {
      content: parsedArticle.content,
      textContent: parsedArticle.textContent,
      byLine: parsedArticle.byline ?? "",
    },
  });

  logger.info(
    {
      article: { id: articleId, link: articleLink },
    },
    "Scraped article.",
  );

  return readability;
};
