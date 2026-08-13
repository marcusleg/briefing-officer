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

// `relevanceReason` precedes `matchesInterests` for the same reason `language`
// precedes `lead`: structured output is generated field by field, so the model
// reasons and then commits. A boolean declared first would be a guess the
// reasoning is written to justify.
const filteringLeadSchema = leadSchema.extend({
  relevanceReason: z
    .string()
    .describe(
      "One sentence explaining why the article does or does not match the " +
        "reader's stated interests. Write it in the same language as the lead.",
    ),
  matchesInterests: z.boolean(),
});

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { feed: true, scrape: true },
    where: { id: articleId },
  });

  const interestProfile = article.feed.interestProfile;
  const filtering = interestProfile !== "";
  const prompt = buildLeadPrompt(
    article.title,
    article.scrape?.textContent ?? "",
    interestProfile,
  );

  // Hoisted into two full calls, rather than picking the schema with a
  // ternary, so `object` keeps the precise shape of the schema that produced
  // it instead of collapsing to a union `generateObject` can't narrow.
  const { object, usage, filtered, filterReason } = filtering
    ? await (async () => {
        const { object, usage } = await generateObject({
          model,
          schema: filteringLeadSchema,
          system: systemPrompt,
          prompt,
        });
        return {
          object,
          usage,
          filtered: !object.matchesInterests,
          filterReason: object.relevanceReason as string | null,
        };
      })()
    : await (async () => {
        const { object, usage } = await generateObject({
          model,
          schema: leadSchema,
          system: systemPrompt,
          prompt,
        });
        return {
          object,
          usage,
          filtered: false,
          filterReason: null as string | null,
        };
      })();

  const language = normalizeLanguage(object.language);

  // Filtering happens in this same write rather than through
  // `setArticleStatus`, the chokepoint that otherwise owns every status change.
  // Routing it there would mean a second round trip or a row that briefly holds
  // a lead with no verdict. It writes `statusChangedAt` alongside `status` just
  // as the chokepoint does. Do not add a second exception without revisiting
  // the design.

  // One nested write, so the language cannot drift out of step with the lead
  // it was determined alongside, nor the verdict from the reason for it.
  await prisma.article.update({
    where: { id: articleId },
    data: {
      language,
      ...(filtered
        ? {
            status: "FILTERED" as const,
            statusChangedAt: new Date(),
            filterReason,
          }
        : {}),
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
      filtered,
      model: model.modelId,
      tokenUsage: usage,
    },
    "AI lead generated.",
  );

  return object.lead;
};
