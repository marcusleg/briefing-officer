"use client";

import ArticleCard from "@/components/article/ArticleCard";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ArticleListProps {
  articles: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
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
    <div className="flex max-w-4xl flex-col space-y-6">
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          className={
            index == selectedArticle
              ? "border-1 border border-gray-800 bg-gray-50"
              : undefined
          }
          article={article}
          onClick={() => setSelectedArticle(index)}
          selected={index === selectedArticle}
        />
      ))}
    </div>
  );
};

export default ArticleList;
