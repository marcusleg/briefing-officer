import prisma from "@/lib/prismaClient";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Speech } from "lucide-react";
import { getAiSummary } from "./actions";
import ToggleReadButton from "@/components/article/ToggleReadButton";
import Typography from "@/components/ui/typography";

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
    <div className="m-2 max-w-4xl flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <BackButton />
        <ToggleReadButton
          feedId={feedId}
          articleId={articleId}
          isRead={article.read}
        />
        <Button variant="outline">
          <Speech className="mr-2 h-4 w-4" />
          Read aloud
        </Button>
      </div>

      <article>
        <Typography variant="h2">{article.title}</Typography>
        <p
          className="text-justify text-pretty hyphens-auto reader-view"
          dangerouslySetInnerHTML={{
            __html: summary.summary.replace(/\n/g, "<br />"),
          }}
        />
      </article>
    </div>
  );
};

export default AiSummary;
