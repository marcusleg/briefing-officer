import ToggleReadButton from "@/components/article/ToggleReadButton";
import BackButton from "@/components/layout/BackButton";
import { Button } from "@/components/ui/button";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import { Speech } from "lucide-react";
import { getAiSummary } from "./actions";

const AiSummary = async ({
  params,
}: {
  params: { feedId: string; articleId: string };
}) => {
  let feedId = parseInt(params.feedId);
  let articleId = parseInt(params.articleId);

  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: articleId,
    },
  });

  const summary = await getAiSummary(articleId);

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
