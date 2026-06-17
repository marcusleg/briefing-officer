"use client";

import ArticleCardActions from "@/components/article/article-card-actions";
import { Prisma } from "@prisma/client";
import { useRouter } from "next/navigation";
import readingTime from "reading-time";

type Article = Prisma.ArticleGetPayload<{
  include: { feed: true; scrape: true };
}>;

const AiSummaryArticleActions = ({ article }: { article: Article }) => {
  const router = useRouter();
  const articleReadingTime = article.scrape
    ? readingTime(article.scrape.textContent)
    : undefined;

  return (
    <ArticleCardActions
      article={article}
      hideSummarizeButton
      readingTime={articleReadingTime}
      onAfterDismiss={() => router.back()}
    />
  );
};

export default AiSummaryArticleActions;
