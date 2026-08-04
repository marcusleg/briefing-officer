"use client";

import ArticleCardActions from "@/components/article/article-card-actions";
import { Prisma } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import readingTime from "reading-time";

type Article = Prisma.ArticleGetPayload<{
  include: { feed: true; scrape: true };
}>;

const AudioSummaryArticleActions = ({ article }: { article: Article }) => {
  const router = useRouter();
  const articleReadingTime = article.scrape
    ? readingTime(article.scrape.textContent)
    : undefined;

  return (
    <ArticleCardActions
      article={article}
      currentPage="audio-summary"
      readingTime={articleReadingTime}
      onAfterDismiss={() => router.back()}
    />
  );
};

export default AudioSummaryArticleActions;
