"use server";

import { FeedFilterKind } from "@/generated/prisma/client";
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

// `exclusionReason` precedes `excludeArticle` for the same reason `language`
// precedes `lead`: structured output is generated field by field, so the model
// reasons and then commits. A boolean declared first would be a guess the
// reasoning is written to justify.
//
// The boolean is named for exclusion, not for matching. Structured output is
// steered by key names as much as by the prompt, and `matchesInterests` — what
// this was called first — inverts against the common "everything except X"
// profile: an article about none of the named topics is not a "match", so the
// model sets false and the article is filtered. Naming the decision after the
// action it triggers removes that trap.
const filteringLeadSchema = leadSchema.extend({
  exclusionReason: z
    .string()
    .describe(
      "One sentence explaining the decision, naming the part of the reader's " +
        "preferences you applied. Write it in the same language as the lead.",
    ),
  excludeArticle: z
    .boolean()
    .describe(
      "True only if the reader's preferences give a clear, positive reason to " +
        "keep this article out of their inbox. When in doubt, false.",
    ),
});

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { feed: { include: { filters: true } }, scrape: true },
    where: { id: articleId },
  });

  const keywordsOfKind = (kind: FeedFilterKind) =>
    article.feed.filters
      .filter((filter) => filter.kind === kind)
      .map((filter) => filter.text);

  const interests = keywordsOfKind("INTEREST");
  const disinterests = keywordsOfKind("DISINTEREST");

  const filtering = interests.length > 0 || disinterests.length > 0;
  const prompt = buildLeadPrompt(
    article.title,
    article.scrape?.textContent ?? "",
    interests,
    disinterests,
  );

  // Each branch makes its own full `generateObject` call, rather than picking
  // the schema with a ternary and calling once, so `object` keeps the precise
  // shape of the schema that produced it instead of collapsing to a union
  // `generateObject` can't narrow.
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
          filtered: object.excludeArticle,
          // Widens `exclusionReason` from `string` to `string | null` so this
          // branch's return type unifies with the non-filtering branch below,
          // which has no reason to report. The schema never actually produces
          // null here.
          filterReason: object.exclusionReason as string | null,
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

  // This function is not only called at ingest, where the design intends
  // filtering to happen. `article-card.tsx` also calls it lazily from the
  // client to backfill a lead for any rendered article that is missing one —
  // including a `READ` or `READ_LATER` article whose lead generation failed
  // the first time around. Without this guard, a late verdict could flip an
  // article the reader already acted on into `FILTERED`, silently pulling it
  // out of Read Later or clobbering its read timestamp. Only an article still
  // sitting in the inbox (`UNREAD`) is eligible to be filtered.
  const shouldApplyFilterVerdict = filtered && article.status === "UNREAD";

  // One nested write, so the language cannot drift out of step with the lead
  // it was determined alongside, nor the verdict from the reason for it.
  await prisma.article.update({
    where: { id: articleId },
    data: {
      language,
      ...(shouldApplyFilterVerdict
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
