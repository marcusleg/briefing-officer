import prisma from "@/lib/prismaClient";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Sparkles, Speech } from "lucide-react";
import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: "eu-central-1",
});
const generateSummary = async (title: string, content: string) => {
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

const AiSummary = async ({
  params,
}: {
  params: { feedId: string; articleId: string };
}) => {
  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: parseInt(params.articleId),
    },
  });

  const readability = await getReadability(article.id, article.link);
  const summary = await generateSummary(article.title, readability.textContent);

  return (
    <div className="m-2 max-w-4xl flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <BackButton />
        <Button variant="outline">
          <Speech className="mr-2 h-4 w-4" />
          Read aloud
        </Button>
      </div>

      <article>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          {article.title}
        </h2>
        <p className="text-justify text-pretty hyphens-auto reader-view whitespace-pre">
          {summary}
        </p>
      </article>
    </div>
  );
};

export default AiSummary;
