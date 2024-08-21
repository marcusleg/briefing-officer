import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import prisma from "@/lib/prismaClient";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

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

  if (articleSummary) {
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

  return prisma.articleAiSummary.create({
    data: {
      articleId: articleId,
      summary: summary,
    },
  });
};
