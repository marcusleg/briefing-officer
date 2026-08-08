"use server";

import { buildAudioScriptPrompt } from "@/lib/ai/prompts";
import { streamGeneration } from "@/lib/ai/streamGeneration";
import { articleAuthor } from "@/lib/article";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

export const streamAudioScript = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId, userId },
    include: { feed: true, scrape: true },
  });

  return streamGeneration({
    userId,
    label: "Audio script",
    context: {
      articleId,
      feedId: article.feedId,
      language: article.language,
    },
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
};
