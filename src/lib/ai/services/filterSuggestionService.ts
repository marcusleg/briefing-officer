"use server";

import { buildFilterSuggestionPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { z } from "zod";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

// No system prompt: the one shared across this module's neighbours casts the
// model as a news editor writing previews, which is the wrong role for naming
// topics to exclude.
const suggestionSchema = z.object({
  suggestions: z
    .array(z.string())
    .length(3)
    .describe(
      "Three topic descriptions, ordered narrow to broad. Short noun phrases.",
    ),
});

export const suggestFilterKeywords = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { feed: { include: { filters: true } }, lead: true },
    where: { id: articleId },
  });

  const existingDisinterests = article.feed.filters
    .filter((filter) => filter.kind === "DISINTEREST")
    .map((filter) => filter.text);

  const existingInterests = article.feed.filters
    .filter((filter) => filter.kind === "INTEREST")
    .map((filter) => filter.text);

  const { object, usage } = await generateObject({
    model,
    schema: suggestionSchema,
    prompt: buildFilterSuggestionPrompt(
      article.title,
      article.lead?.text ?? article.description ?? "",
      existingDisinterests,
      existingInterests,
    ),
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
  );

  logger.info(
    { articleId, feedId: article.feedId, model: model.modelId },
    "Filter keyword suggestions generated.",
  );

  return object.suggestions;
};
