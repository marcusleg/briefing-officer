"use server";

import { buildAudioScriptPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import { articleAuthor } from "@/lib/article";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { createStreamableValue } from "@ai-sdk/rsc";
import { streamText } from "ai";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

export const streamAudioScript = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId, userId },
    include: { feed: true, scrape: true },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream, totalUsage } = streamText({
      model,
      system: systemPrompt,
      prompt: buildAudioScriptPrompt({
        title: article.title,
        // The existing helper, so the feed-declared author keeps winning over
        // Readability's byline and no second notion of "the author" appears.
        author: articleAuthor(article),
        feedTitle: article.feed.title,
        textContent: article.scrape?.textContent ?? "",
        language: article.language,
      }),
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();

    const tokenUsage = await totalUsage;

    logger.info(
      {
        articleId,
        feedId: article.feedId,
        language: article.language,
        model: model.modelId,
        tokenUsage,
      },
      "Audio script generated.",
    );

    await trackTokenUsage(
      userId,
      model.modelId,
      tokenUsage.inputTokens ?? 0,
      tokenUsage.outputTokens ?? 0,
    );
  })();

  return { output: stream.value };
};
