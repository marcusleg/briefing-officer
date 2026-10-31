"use client";

import ArticleCardActions from "@/components/article/article-card-actions";
import { useWithOverrides } from "@/components/article/article-overrides";
import { Prisma } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";

const SummaryArticleActions = ({
  article,
  currentPage,
}: {
  article: Prisma.ArticleGetPayload<{ include: { feed: true; scrape: true } }>;
  currentPage: "text-summary" | "audio-summary";
}) => {
  const router = useRouter();
  const withOverrides = useWithOverrides();

  return (
    <ArticleCardActions
      article={withOverrides(article)}
      currentPage={currentPage}
      onAfterDismiss={() => router.back()}
    />
  );
};

export default SummaryArticleActions;
