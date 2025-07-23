"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { scrapeArticle } from "@/lib/scraper";
import { createAzure } from "@ai-sdk/azure";
import { createStreamableValue } from "@ai-sdk/rsc";
import { generateText, streamText } from "ai";
import { revalidatePath } from "next/cache";

const azureOpenAi = createAzure({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
});

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

  const summary = await generateText({
    model: azureOpenAi("gpt-4.1-nano"),
    prompt: `Write a summary of the following article. Leave the headline as is. Format your response in Markdown. \n\n${article.title}\n\n${scrape.textContent}`,
  });

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
      summary: summary.text,
    },
    update: {
      articleId: articleId,
      summary: summary.text,
    },
  });
};

export const streamAiSummary = async (articleId: number) => {
  const articleScrape = await prisma.articleScrape.findUniqueOrThrow({
    where: { articleId: articleId },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream } = streamText({
      model: azureOpenAi("gpt-4.1-nano"),
      prompt: `Write a summary of the following article. Leave the headline as is. Format your response in Markdown.\n\n${articleScrape.textContent}`,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
};

interface GenerateAiLeadOptions {
  forceGeneration: boolean;
}

const defaultGenerateAiLeadOptions: GenerateAiLeadOptions = {
  forceGeneration: false,
};

export const generateAiLead = async (
  articleId: number,
  options?: GenerateAiLeadOptions,
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

  const lead = await generateText({
    model: azureOpenAi("gpt-4.1-nano"),
    prompt: `Analyze the following news article and create a short, factual lead that provides an overview of what the article is about and why it is worth reading. The text should be continuous, objective, concise and no longer than 80 words. Begin directly with the content of the lead, without any introductory phrases.\n\n${article.title}\n\n${scrape.textContent}`,
  });

  const newLead = prisma.articleAiTexts.upsert({
    where: { articleId: articleId },
    create: {
      articleId: articleId,
      lead: lead.text,
    },
    update: {
      articleId: articleId,
      lead: lead.text,
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

// const generateAiTags = () => {
//   // Prompt: Please generate a list of most relevant tags for the following news article that can help categorize and improve the discoverability of this article. The tags should cover specific topics, people, places, events, and any other relevant keywords. Make sure they are concise and relevant to the content provided. Provide the tags as a comma-separated list only, with no additional text.
// };
