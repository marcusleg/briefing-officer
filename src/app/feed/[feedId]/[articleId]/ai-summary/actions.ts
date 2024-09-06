"use server";

import { scrapeArticle } from "@/lib/articleScraper";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { ConfiguredRetryStrategy } from "@smithy/util-retry";
import { revalidatePath } from "next/cache";

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: "eu-central-1",
  retryStrategy: new ConfiguredRetryStrategy(10, 2000),
});

const promptClaude = async (text: string) => {
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: text,
          },
        ],
      },
    ],
  });
  const response = await bedrockRuntimeClient.send(command);

  if (
    !response.output?.message?.content ||
    response.output?.message?.content?.length == 0
  ) {
    return null;
  }

  return response.output?.message.content[0].text;
};

export const getAiSummary = async (articleId: number) => {
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

  const summary = await promptClaude(
    `Sum up the following article. Format your response in Markdown. \n\n${article.title}\n\n${scrape.textContent}`,
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

  const lead = await promptClaude(
    `Analyze the following news article and create a short, factual lead that provides an overview of what the article is about and why it is worth reading. The text should be continuous, objective, concise and no longer than 80 words. Reply in the same language in which the article is written.\n\n${article.title}\n\n${scrape.textContent}`,
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
