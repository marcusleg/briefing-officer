"use server";

import { cacheMiddleware } from "@/lib/aiMiddleware/cache";
import { anthropicClaude } from "@/lib/aiModels/anthrophic";
import { azureOpenAiChatGpt } from "@/lib/aiModels/azureOpenai";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { createStreamableValue } from "@ai-sdk/rsc";
import { generateText, streamText, wrapLanguageModel } from "ai";

const baseLanguageModel = await Promise.any([
  anthropicClaude(),
  azureOpenAiChatGpt(),
]);

const wrappedLanguageModel = wrapLanguageModel({
  model: baseLanguageModel,
  middleware: [cacheMiddleware],
});

const systemPrompt =
  "You are an expert at summarizing articles for professionals who want to quickly understand core content, key facts, and main arguments.";

export const streamAiSummary = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId, userId },
    include: { scrape: true },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream, totalUsage } = streamText({
      model: wrappedLanguageModel,
      system: systemPrompt,
      prompt: `Write a summary in the following structure and **format your response in Markdown**:

- Key Points (as a bullet list; use "Key Facts" for factual articles or "Key Takeaways" for opinion pieces)
  Highlight one keywords or key term per bullet point in bold.
- Executive Summary
  Focus on a high information density while maintaining clear, readable language. Include all major points, arguments, or findings that are most relevant to understanding the article as a whole. Do not simply copy text verbatim — paraphrase and condense where appropriate.
  Use paragraphs with headings to logically organize the information and emphasize key points. For major sections, use level 4 headings (\`####\`). For subsections that provide additional detail or clarification, use level 5 headings (\`#####\`). Feel free to include unstructured paragraphs when appropriate for smooth narrative flow.
- Why the Full Article Is Worth Reading
  Only include this section if the full article offers additional detail, nuance, or unique value that is not fully captured in your summary. If the summary sufficiently covers all key content, you may omit this section.

 Each should use a level 3 headings (\`###\`) with the respective content underneath:

Below is the article:

${article.scrape?.textContent}`,
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
        model: wrappedLanguageModel.modelId,
        tokenUsage,
      },
      "AI summary generated.",
    );

    await trackTokenUsage(
      userId,
      wrappedLanguageModel.modelId,
      tokenUsage.inputTokens ?? 0,
      tokenUsage.outputTokens ?? 0,
      tokenUsage.reasoningTokens ?? 0,
    );
  })();

  return { output: stream.value };
};

export const generateAiLead = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    include: { scrape: true },
    where: { id: articleId, userId },
  });

  const lead = await generateText({
    model: wrappedLanguageModel,
    system: systemPrompt,
    prompt: `Write a single, continuous lead that is factual, objective, and provides an overview of what the article is about and why it is worth reading. The lead must be **no longer than 80 words**. Do not add any introduction, headings, or repeated information.
${article.title}\n\n${article.scrape?.textContent}`,
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
    userId,
    wrappedLanguageModel.modelId,
    lead.totalUsage.inputTokens ?? 0,
    lead.totalUsage.outputTokens ?? 0,
    lead.totalUsage.reasoningTokens ?? 0,
  );

  logger.info(
    {
      articleId,
      feedId: article.feedId,
      model: wrappedLanguageModel.modelId,
      tokenUsage: lead.totalUsage,
    },
    "AI lead generated.",
  );
};

const trackTokenUsage = async (
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  reasoningTokens: number,
) => {
  const date = new Date().toISOString().split("T")[0];

  await prisma.tokenUsage.upsert({
    where: {
      userId_date_model: {
        userId,
        date,
        model: model,
      },
    },
    create: {
      userId,
      date,
      model: model,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      reasoningTokens: reasoningTokens,
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      reasoningTokens: { increment: reasoningTokens },
    },
  });
};
