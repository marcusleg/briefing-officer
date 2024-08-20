import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import prisma from "@/lib/prismaClient";
import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: "eu-central-1",
});
export const generateSummary = async (title: string, content: string) => {
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: `Sum up this article:\n\n${title}\n\n${content}`,
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

  if (articleSummary) {
    return articleSummary;
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const readability = await getReadability(article.id, article.link);

  const summary = await generateSummary(article.title, readability.textContent);
  if (!summary) {
    throw new Error("Failed to generate summary");
  }

  return prisma.articleAiSummary.create({
    data: {
      articleId: articleId,
      summary: summary,
    },
  });
};
