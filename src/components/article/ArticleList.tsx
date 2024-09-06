"use client";

import ArticleCard from "@/components/article/ArticleCard";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ArticleListProps {
  articles: Prisma.ArticleGetPayload<{
    include: { aiTexts: true; feed: true; readability: true };
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
    <div className="flex flex-col gap-4">
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          className={
            index == selectedArticle
              ? "bg-gray-50 outline outline-1 outline-gray-800"
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
