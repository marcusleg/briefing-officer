"use client";

import ArticleCard from "@/components/article/article-card";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { Prisma } from "@/generated/prisma/client";
import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type ListedArticle = Prisma.ArticleGetPayload<{
  include: { feed: true; lead: true; scrape: true };
}>;

interface ArticleListProps {
  articles: ListedArticle[];
}

const idsOf = (articles: ListedArticle[]) =>
  articles.map((article) => article.id);

/**
 * Renders the articles it has already shown and holds the rest behind a
 * "Show N new articles" button, so a live refresh never pushes the list
 * around under the reader. Articles already on screen still update in place
 * and disappear when the server stops returning them.
 */
const ArticleList = ({ articles }: ArticleListProps) => {
  const { userRefreshActive } = useLiveUpdates();
  const [selectedArticle, setSelectedArticle] = useState<number>();
  const [seenIds, setSeenIds] = useState(() => new Set(idsOf(articles)));

  const unseen = articles.filter((article) => !seenIds.has(article.id));

  // The reader asked for this refresh, so its articles are what they want to
  // see. Adjusting state during render is React's pattern for deriving state
  // from a prop change without a flash of the intermediate render.
  if (userRefreshActive && unseen.length > 0) {
    setSeenIds(new Set([...seenIds, ...idsOf(unseen)]));
  }

  const visible = articles.filter((article) => seenIds.has(article.id));
  const heldCount = articles.length - visible.length;

  const showNewArticles = () => {
    setSeenIds(new Set([...seenIds, ...idsOf(articles)]));
  };

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

    if (selectedArticle === visible.length - 1) {
      return;
    }

    setSelectedArticle(selectedArticle + 1);
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-6">
      {heldCount > 0 && (
        <Button
          className="cursor-pointer self-center"
          onClick={showNewArticles}
          variant="outline"
        >
          <ArrowUpIcon className="size-4" />
          Show {heldCount} new {heldCount === 1 ? "article" : "articles"}
        </Button>
      )}

      {visible.map((article, index) => (
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
