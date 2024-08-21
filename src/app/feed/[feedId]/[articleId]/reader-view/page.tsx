import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import { markArticleAsRead } from "@/app/feed/[feedId]/actions";
import ReadAloudButton from "@/components/article/ReadAloudButton";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import { Sparkles } from "lucide-react";

const ReaderView = async ({
  params,
}: {
  params: { feedId: string; articleId: string };
}) => {
  const feedId = parseInt(params.feedId);
  const articleId = parseInt(params.articleId);

  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: articleId,
    },
  });

  const readerDocument = await getReadability(article.id, article.link);
  void markArticleAsRead(feedId, articleId);

  return (
    <div className="m-2 flex max-w-4xl flex-col gap-2">
      <div className="flex flex-row gap-2">
        <BackButton />
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          AI Summary
        </Button>
        <ReadAloudButton feedId={feedId} articleId={articleId} />
      </div>

      <article>
        <Typography variant="h2">{article.title}</Typography>
        <p className="text-sm text-muted-foreground">
          {readerDocument?.byLine}
        </p>
        <p
          className="reader-view hyphens-auto text-pretty text-justify"
          dangerouslySetInnerHTML={{ __html: readerDocument?.content }}
        ></p>
      </article>
    </div>
  );
};

export default ReaderView;
