"use server";

import { scrapeArticle } from "@/lib/articleScraper";
import { promptOpenAI } from "@/lib/llm/openai";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { revalidatePath } from "next/cache";

export const generateAiSummary = async (articleId: number) => {
  const articleSummary = await prisma.articleAiTexts.findUnique({
    where: { articleId: articleId },
  });

  if (articleSummary?.summary) {
    return articleSummary;
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const scrape = await scrapeArticle(article.id, article.link);

  const summary = await promptOpenAI(
    `Write a summary of the following article. Leave the headline as is. Reply in the same language in which the article is written. Format your response in Markdown. \n\n${article.title}\n\n${scrape.textContent}`,
  );
  if (!summary) {
    throw new Error("Failed to generate summary");
  }

  logger.info(
    {
      articleId,
      articleTitle: article.title,
      feedId: article.feedId,
    },
    "Generated AI summary for article.",
  );

  return prisma.articleAiTexts.upsert({
    where: { articleId: articleId },
    create: {
      articleId: articleId,
      summary: summary,
    },
    update: {
      articleId: articleId,
      summary: summary,
    },
  });
};

interface GenerateAiLeadOptios {
  forceGeneration: boolean;
}

const defaultGenerateAiLeadOptions: GenerateAiLeadOptios = {
  forceGeneration: false,
};

export const generateAiLead = async (
  articleId: number,
  options?: GenerateAiLeadOptios,
) => {
  const mergedOptions = { ...defaultGenerateAiLeadOptions, ...options };

  if (!mergedOptions.forceGeneration) {
    const articleAiTexts = await prisma.articleAiTexts.findUnique({
      where: { articleId: articleId },
    });

    if (articleAiTexts?.lead) {
      return articleAiTexts;
    }
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const scrape = await scrapeArticle(article.id, article.link);

  const lead = await promptOpenAI(
    `Analyze the following news article and create a short, factual lead that provides an overview of what the article is about and why it is worth reading. The text should be continuous, objective, concise and no longer than 80 words. Begin directly with the content of the lead, without any introductory phrases. Reply in the same language in which the article is written.\n\n${article.title}\n\n${scrape.textContent}`,
  );
  if (!lead) {
    throw new Error("Failed to generate summary");
  }

  const newLead = prisma.articleAiTexts.upsert({
    where: { articleId: articleId },
    create: {
      articleId: articleId,
      lead: lead,
    },
    update: {
      articleId: articleId,
      lead: lead,
    },
  });

  logger.info(
    {
      articleId,
      articleTitle: article.title,
      feedId: article.feedId,
    },
    "Generated AI lead for article.",
  );

  revalidatePath(`/feed/${article.feedId}`);

  return newLead;
};
