"use client";

import {
  markArticleAsRead,
  markArticleAsUnread,
} from "@/app/feed/[feedId]/actions";
import ArticleCard from "@/components/article/ArticleCard";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ArticleListProps {
  articles: Prisma.ArticleGetPayload<{ include: { aiSummary: true } }>[];
}

const ArticleList = ({ articles }: ArticleListProps) => {
  const [selectedArticle, setSelectedArticle] = useState<number>();

  useHotkeys("v", async () => {
    if (selectedArticle === undefined) {
      return;
    }

    window.open(articles[selectedArticle].link, "_blank");
    await markArticleAsRead(articles[selectedArticle].id);
  });

  useHotkeys("p", () => {
    if (selectedArticle === undefined || selectedArticle === 0) {
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

  useHotkeys("m", async () => {
    if (selectedArticle === undefined) {
      return;
    }

    if (articles[selectedArticle].read) {
      await markArticleAsUnread(articles[selectedArticle].id);
    } else {
      await markArticleAsRead(articles[selectedArticle].id);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          className={
            index == selectedArticle
              ? "outline outline-2 outline-gray-800"
              : undefined
          }
          article={article}
          onClick={() => setSelectedArticle(index)}
        />
      ))}
    </div>
  );
};

export default ArticleList;
