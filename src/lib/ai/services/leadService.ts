"use server";

import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateText } from "ai";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

const systemPrompt =
  "You are an expert at summarizing articles for professionals who want to quickly understand core content, key facts, and main arguments.";

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { scrape: true },
    where: { id: articleId },
  });

  const lead = await generateText({
    model,
    system: systemPrompt,
    prompt: `Write a single, continuous lead that is factual, objective, and provides an overview of what the article is about and why it is worth reading. The lead must be **no longer than 80 words**. Do not add any introduction, headings, or repeated information.
${article.title}\n\n${article.scrape?.textContent}`,
  });

  await prisma.articleLead.upsert({
    where: { articleId },
    create: {
      articleId,
      text: lead.text,
    },
    update: {
      text: lead.text,
    },
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    lead.totalUsage.inputTokens ?? 0,
    lead.totalUsage.outputTokens ?? 0,
    lead.totalUsage.reasoningTokens ?? 0,
  );

  logger.info(
    {
      articleId,
      feedId: article.feedId,
      model: model.modelId,
      tokenUsage: lead.totalUsage,
    },
    "AI lead generated.",
  );

  return lead.text;
};
