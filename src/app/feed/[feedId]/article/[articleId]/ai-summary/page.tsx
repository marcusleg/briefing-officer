"use server";

import AiSummaryStream from "@/components/article/AiSummaryStream";
import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import prisma from "@/lib/prismaClient";

const AiSummary = async (props0: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const params = await props0.params;
  let articleId = parseInt(params.articleId);

  const article = await prisma.article.findUniqueOrThrow({
    include: {
      aiTexts: true,
      feed: true,
      scrape: true,
    },
    where: {
      id: articleId,
    },
  });

  return (
    <div className="m-2 flex flex-col gap-2">
      <ArticleCardActions article={article} hideAiSummary showBackButton />

      <article>
        <AiSummaryStream articleId={articleId} />
      </article>
    </div>
  );
};

export default AiSummary;
