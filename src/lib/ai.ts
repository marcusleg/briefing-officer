"use server";

import { cacheMiddleware } from "@/lib/aiMiddleware/cache";
import prisma from "@/lib/prismaClient";
import { createAzure } from "@ai-sdk/azure";
import { createStreamableValue } from "@ai-sdk/rsc";
import { streamText, wrapLanguageModel } from "ai";

const azureOpenAi = createAzure({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
});

const wrappedModel = wrapLanguageModel({
  model: azureOpenAi("gpt-4.1-nano"),
  middleware: [cacheMiddleware],
});

const systemPrompt =
  "You are an expert at summarizing articles for professionals who want to quickly understand core content, key facts, and main arguments.";

export const streamAiSummary = async (articleId: number) => {
  const articleScrape = await prisma.articleScrape.findUniqueOrThrow({
    where: { articleId: articleId },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream } = streamText({
      model: wrappedModel,
      system: systemPrompt,
      prompt: `Write a summary in the following structure and **format your response in Markdown**:

- The original article title should be a level 1 heading (\`#\`).
- Directly under the title, write a single paragraph containing a highly condensed description of the article's contents.
  Omit this paragraph if your full summary is only slightly longer than this condensed description.
- The following sections should each use level 2 headings (\`##\`) with the respective content underneath:
    - Key Points (as a bullet list; use "Key Facts" for factual articles or "Key Takeaways" for opinion pieces)
    - Summary
      It must be shorter than the original article, but should not omit important, relevant, or interesting information. Focus on a high information density while maintaining clear, readable language. Include all major points, arguments, or findings that are most relevant to understanding the article as a whole. Do not simply copy text verbatim—paraphrase and condense where appropriate.
    - Why the Full Article Might Be Worth Reading
      Only include this section if the full article offers additional detail, nuance, or unique value that is not fully captured in your summary. If the summary sufficiently covers all key content, you may omit this section.

Below is the article:

${articleScrape.textContent}`,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
};

export const streamAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { scrape: true },
    where: { id: articleId },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream } = streamText({
      model: wrappedModel,
      system: systemPrompt,
      prompt: `Write a single, continuous lead that is factual, objective, and provides an overview of what the article is about and why it is worth reading. The lead must be **no longer than 80 words**. Do not add any introduction, headings, or repeated information.
${article.title}\n\n${article.scrape?.textContent}`,
      maxOutputTokens: 120,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
};
