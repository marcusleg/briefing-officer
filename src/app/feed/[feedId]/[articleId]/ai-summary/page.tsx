import ToggleReadButton from "@/components/article/ToggleReadButton";
import BackButton from "@/components/layout/BackButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import { AlertCircleIcon, Speech } from "lucide-react";
import Markdown from "markdown-to-jsx";
import { getAiSummary } from "../../../../../lib/ai";

const AiSummary = async ({
  params,
}: {
  params: { feedId: string; articleId: string };
}) => {
  let articleId = parseInt(params.articleId);

  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: articleId,
    },
  });

  const summary = await getAiSummary(articleId);

  if (!summary.summary) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Failed to obtain AI summary</AlertTitle>
        <AlertDescription>
          The summary field in database is null.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="m-2 flex flex-col gap-2">
      <div className="flex flex-row flex-wrap gap-2">
        <BackButton />
        <ToggleReadButton article={article} />
        <Button variant="outline">
          <Speech className="mr-2 h-4 w-4" />
          Read aloud
        </Button>
      </div>

      <article>
        <Markdown
          className="flex flex-col gap-4"
          options={{
            overrides: {
              h1: {
                component: Typography,
                props: { variant: "h1" },
              },
              h2: {
                component: Typography,
                props: { variant: "h2" },
              },
              h3: {
                component: Typography,
                props: { variant: "h3" },
              },
              h4: {
                component: Typography,
                props: { variant: "h4" },
              },
              h5: {
                component: Typography,
                props: { variant: "h5" },
              },
              h6: {
                component: Typography,
                props: { variant: "h6" },
              },
              ul: {
                component: Typography,
                props: { variant: "ul" },
              },
              ol: {
                component: Typography,
                props: { variant: "ol" },
              },
              p: {
                component: Typography,
                props: {
                  className: "hyphens-auto text-pretty text-justify",
                  variant: "p",
                },
              },
            },
          }}
        >
          {summary.summary}
        </Markdown>
      </article>
    </div>
  );
};

export default AiSummary;
