"use client";

import ArticleCardActions from "@/components/article/article-card-actions";
import { Prisma } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";

const ArticleSubpageActions = ({
  article,
  currentPage,
}: {
  article: Prisma.ArticleGetPayload<{ include: { feed: true; scrape: true } }>;
  currentPage: "text-summary";
}) => {
  const router = useRouter();

  return (
    <ArticleCardActions
      article={article}
      currentPage={currentPage}
      onAfterDismiss={() => router.back()}
    />
  );
};

export default ArticleSubpageActions;
