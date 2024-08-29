import ToggleReadButton from "@/components/article/ToggleReadButton";
import BackButton from "@/components/layout/BackButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import { AlertCircleIcon, Speech } from "lucide-react";
import { getAiSummary } from "./actions";

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
        <ToggleReadButton articleId={articleId} isRead={article.read} />
        <Button variant="outline">
          <Speech className="mr-2 h-4 w-4" />
          Read aloud
        </Button>
      </div>

      <article>
        <Typography variant="h2">{article.title}</Typography>
        <p
          className="reader-view hyphens-auto text-pretty text-justify"
          dangerouslySetInnerHTML={{
            __html: summary.summary.replace(/\n/g, "<br />"),
          }}
        />
      </article>
    </div>
  );
};

export default AiSummary;
