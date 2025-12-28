"use server";

import { buildLeadPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateText } from "ai";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { scrape: true },
    where: { id: articleId },
  });

  const lead = await generateText({
    model,
    system: systemPrompt,
    prompt: buildLeadPrompt(article.title, article.scrape?.textContent ?? ""),
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
