import { scrapeArticle } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import AiSummaryButton from "@/components/article/AiSummaryButton";
import ReadAloudButton from "@/components/article/ReadAloudButton";
import VisitButton from "@/components/article/VisitButton";
import BackButton from "@/components/layout/BackButton";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import { markArticleAsRead } from "@/lib/repository/articleRepository";

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

  const readerDocument = await scrapeArticle(article.id, article.link);
  void markArticleAsRead(articleId);

  return (
    <div className="m-2 flex flex-col gap-2">
      <div className="flex flex-row flex-wrap gap-2">
        <BackButton />
        <VisitButton article={article} />
        <AiSummaryButton feedId={article.feedId} articleId={article.id} />
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
