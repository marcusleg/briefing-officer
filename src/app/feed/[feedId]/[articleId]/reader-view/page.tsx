import prisma from "@/lib/prismaClient";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Sparkles, Speech } from "lucide-react";
import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import { markArticleAsRead } from "@/app/feed/[feedId]/actions";
import ReadAloudButton from "@/components/ReadAloudButton";

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
    <div className="m-2 max-w-4xl flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <BackButton />
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          AI Summary
        </Button>
        <ReadAloudButton feedId={feedId} articleId={articleId} />
      </div>

      <article>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          {article.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {readerDocument?.byLine}
        </p>
        <p
          className="text-justify text-pretty hyphens-auto reader-view"
          dangerouslySetInnerHTML={{ __html: readerDocument?.content }}
        ></p>
      </article>
    </div>
  );
};

export default ReaderView;
