"use client";

import ArticleCard from "@/components/article/article-card";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Prisma } from "../../../prisma/generated/prisma/client";

interface ArticleListProps {
  articles: Prisma.ArticleGetPayload<{
    include: { feed: true; lead: true; scrape: true };
  }>[];
}

const ArticleList = ({ articles }: ArticleListProps) => {
  const [selectedArticle, setSelectedArticle] = useState<number>();

  useHotkeys("p", () => {
    if (selectedArticle === undefined) {
      return;
    }

    if (selectedArticle === 0) {
      setSelectedArticle(undefined);
      return;
    }

    setSelectedArticle(selectedArticle - 1);
  });

  useHotkeys("n", () => {
    if (selectedArticle === undefined) {
      setSelectedArticle(0);
      return;
    }

    if (selectedArticle === articles.length - 1) {
      return;
    }

    setSelectedArticle(selectedArticle + 1);
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-6">
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          article={article}
          onClick={() => setSelectedArticle(index)}
          selected={index === selectedArticle}
        />
      ))}
    </div>
  );
};

export default ArticleList;
