"use server";

import { buildSummaryPrompt } from "@/lib/ai/prompts";
import { streamGeneration } from "@/lib/ai/streamGeneration";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

export const streamAiSummary = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId, userId },
    include: { scrape: true },
  });

  return streamGeneration({
    userId,
    label: "AI summary",
    context: {
      articleId,
      feedId: article.feedId,
      language: article.language,
    },
    prompt: buildSummaryPrompt(
      article.title,
      article.scrape?.textContent ?? "",
      article.language,
    ),
  });
};
