"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { scrapeArticle } from "@/lib/scraper";
import { createAzure } from "@ai-sdk/azure";
import { createStreamableValue } from "@ai-sdk/rsc";
import { generateText, streamText } from "ai";
import { revalidatePath } from "next/cache";

const azureOpenAi = createAzure({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
});

export const streamAiSummary = async (articleId: number) => {
  const articleScrape = await prisma.articleScrape.findUniqueOrThrow({
    where: { articleId: articleId },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream } = streamText({
      model: azureOpenAi("gpt-4.1-nano"),
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

interface GenerateAiLeadOptions {
  forceGeneration: boolean;
}

const defaultGenerateAiLeadOptions: GenerateAiLeadOptions = {
  forceGeneration: false,
};

export const generateAiLead = async (
  articleId: number,
  options?: GenerateAiLeadOptions,
) => {
  const mergedOptions = { ...defaultGenerateAiLeadOptions, ...options };

  if (!mergedOptions.forceGeneration) {
    const articleAiTexts = await prisma.articleAiTexts.findUnique({
      where: { articleId: articleId },
    });

    if (articleAiTexts?.lead) {
      return articleAiTexts;
    }
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const scrape = await scrapeArticle(article.id, article.link);

  const lead = await generateText({
    model: azureOpenAi("gpt-4.1-nano"),
    prompt: `Analyze the following news article and create a short, factual lead that provides an overview of what the article is about and why it is worth reading. The text should be continuous, objective, concise and no longer than 80 words. Begin directly with the content of the lead, without any introductory phrases.\n\n${article.title}\n\n${scrape.textContent}`,
  });

  const newLead = prisma.articleAiTexts.upsert({
    where: { articleId: articleId },
    create: {
      articleId: articleId,
      lead: lead.text,
    },
    update: {
      articleId: articleId,
      lead: lead.text,
    },
  });

  logger.info(
    {
      articleId,
      articleTitle: article.title,
      feedId: article.feedId,
    },
    "Generated AI lead for article.",
  );

  revalidatePath(`/feed/${article.feedId}`);

  return newLead;
};

// const generateAiTags = () => {
//   // Prompt: Please generate a list of most relevant tags for the following news article that can help categorize and improve the discoverability of this article. The tags should cover specific topics, people, places, events, and any other relevant keywords. Make sure they are concise and relevant to the content provided. Provide the tags as a comma-separated list only, with no additional text.
// };
