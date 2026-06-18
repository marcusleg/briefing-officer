"use server";

import { buildLeadPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import { recordAiLeadGeneration } from "@/lib/metrics";
import prisma from "@/lib/prismaClient";
import { generateText } from "ai";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { feed: true, scrape: true },
    where: { id: articleId },
  });

  try {
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

    try {
      recordAiLeadGeneration({
        userId: article.userId,
        feedName: article.feed.title,
        status: "success",
      });
    } catch {
      // Metrics failures must never break lead generation.
    }

    return lead.text;
  } catch (error) {
    try {
      recordAiLeadGeneration({
        userId: article.userId,
        feedName: article.feed.title,
        status: "error",
      });
    } catch {
      // Metrics failures must never hide the original failure.
    }

    throw error;
  }
};
