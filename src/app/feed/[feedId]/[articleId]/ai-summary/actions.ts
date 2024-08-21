"use server";

import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import prisma from "@/lib/prismaClient";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { revalidatePath } from "next/cache";

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: "eu-central-1",
});
const promptClaude = async (text: string) => {
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: text,
          },
        ],
      },
    ],
  });
  const response = await bedrockRuntimeClient.send(command);

  if (response.output?.message?.content?.length == 0) {
    return null;
  }

  return response.output?.message.content[0].text;
};

export const getAiSummary = async (articleId: number) => {
  const articleSummary = await prisma.articleAiSummary.findUnique({
    where: { articleId: articleId },
  });

  if (articleSummary?.summary) {
    return articleSummary;
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const readability = await getReadability(article.id, article.link);

  const summary = await promptClaude(
    `Sum up the following article. Format your response in Markdown. \n\n${article.title}\n\n${readability.textContent}`,
  );
  if (!summary) {
    throw new Error("Failed to generate summary");
  }

  return prisma.articleAiSummary.upsert({
    where: { articleId: articleId },
    create: {
      articleId: articleId,
      summary: summary,
    },
    update: {
      articleId: articleId,
      summary: summary,
    },
  });
};

export const getAiLead = async (feedId: number, articleId: number) => {
  const articleAiSummary = await prisma.articleAiSummary.findUnique({
    where: { articleId: articleId },
  });

  if (articleAiSummary?.lead) {
    return articleAiSummary;
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const readability = await getReadability(article.id, article.link);

  const lead = await promptClaude(
    `Please analyze the following news article and create a short, factual lead that provides an overview of what the article is about and why it is worth reading. The text should be continuous, objective, concise and no longer than 80 words.\n\n${article.title}\n\n${readability.textContent}`,
  );
  if (!lead) {
    throw new Error("Failed to generate summary");
  }

  const newLead = prisma.articleAiSummary.upsert({
    where: { articleId: articleId },
    create: {
      articleId: articleId,
      lead: lead,
    },
    update: {
      articleId: articleId,
      lead: lead,
    },
  });

  revalidatePath(`/feed/${feedId}`);

  return newLead;
};
