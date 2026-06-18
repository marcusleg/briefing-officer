"use server";

import { buildSummaryPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import { recordAiSummaryGeneration } from "@/lib/metrics";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { createStreamableValue } from "@ai-sdk/rsc";
import { streamText } from "ai";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

export const streamAiSummary = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId, userId },
    include: {
      feed: {
        select: {
          title: true,
        },
      },
      scrape: true,
    },
  });

  const stream = createStreamableValue("");

  void (async () => {
    let finished = false;

    const finishStream = () => {
      if (finished) {
        return;
      }

      finished = true;
      stream.done();
    };

    try {
      const { textStream, totalUsage } = await Promise.resolve(
        streamText({
          model,
          system: systemPrompt,
          prompt: buildSummaryPrompt(
            article.title,
            article.scrape?.textContent ?? "",
          ),
        }),
      );

      for await (const delta of textStream) {
        stream.update(delta);
      }

      finishStream();

      try {
        recordAiSummaryGeneration({
          userId,
          feedName: article.feed.title,
          status: "success",
        });
      } catch {
        // Metrics failures must never break summary generation.
      }

      try {
        const tokenUsage = await totalUsage;

        logger.info(
          {
            articleId,
            feedId: article.feedId,
            model: model.modelId,
            tokenUsage,
          },
          "AI summary generated.",
        );

        try {
          await trackTokenUsage(
            userId,
            model.modelId,
            tokenUsage.inputTokens ?? 0,
            tokenUsage.outputTokens ?? 0,
          );
        } catch {
          // Token usage tracking must never break summary generation.
        }
      } catch (error) {
        logger.error(
          {
            articleId,
            feedId: article.feedId,
            model: model.modelId,
            error,
          },
          "AI summary token usage bookkeeping failed.",
        );
      }
    } catch (error) {
      try {
        recordAiSummaryGeneration({
          userId,
          feedName: article.feed.title,
          status: "error",
        });
      } catch {
        // Metrics failures must never hide the original failure.
      }

      try {
        finishStream();
      } catch {
        // Stream completion must never break product workflows.
      }

      logger.error(
        {
          articleId,
          feedId: article.feedId,
          model: model.modelId,
          error,
        },
        "AI summary generation failed.",
      );
    }
  })();

  return { output: stream.value };
};
