"use server";

import { buildLeadPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import { normalizeLanguage } from "@/lib/language";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { z } from "zod";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

// `language` is declared before `lead` deliberately. Structured output is
// generated field by field, so the model commits to a language and then writes
// the lead in it, rather than reporting one after the fact.
//
// "und" is the registered code for "undetermined". It is described explicitly
// because it is the one permitted value that is not an ISO 639-1 code —
// "two letters, or this one three-letter word" otherwise reads as a
// contradiction and invites "un" or "unknown" instead. Nothing special-cases
// it downstream: normalizeLanguage rejects it on length, like any other
// unusable value.
const leadSchema = z.object({
  language: z
    .string()
    .describe(
      'The article\'s language as a two-letter ISO 639-1 code, for example "de". Use "und" — the standard code for "undetermined" — if the language cannot be established.',
    ),
  lead: z.string(),
});

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { scrape: true },
    where: { id: articleId },
  });

  const { object, usage } = await generateObject({
    model,
    schema: leadSchema,
    system: systemPrompt,
    prompt: buildLeadPrompt(article.title, article.scrape?.textContent ?? ""),
  });

  const language = normalizeLanguage(object.language);

  // One nested write, so the language cannot drift out of step with the lead
  // it was determined alongside.
  await prisma.article.update({
    where: { id: articleId },
    data: {
      language,
      lead: {
        upsert: {
          create: { text: object.lead },
          update: { text: object.lead },
        },
      },
    },
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
  );

  logger.info(
    {
      articleId,
      feedId: article.feedId,
      language,
      model: model.modelId,
      tokenUsage: usage,
    },
    "AI lead generated.",
  );

  return object.lead;
};
