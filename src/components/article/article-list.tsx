"use client";

import ArticleCard from "@/components/article/article-card";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { ArticleStatus, Prisma } from "@/generated/prisma/client";
import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type ListedArticle = Prisma.ArticleGetPayload<{
  include: { feed: true; lead: true; scrape: true };
}>;

interface ArticleListProps {
  articles: ListedArticle[];
}

/**
 * The highlighted article, the row it currently occupies, and its status at
 * the time it was highlighted. The status is kept alongside the row so a
 * status change (moving into or out of Read Later) can be told apart from
 * merely shifting position.
 */
interface Selection {
  id: number;
  index: number;
  status: ArticleStatus;
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
  // Selection is by id, not position: showing held articles prepends to the
  // list, and the highlight has to stay on the article the reader chose. Its
  // position and status ride along: position so the highlight can move on
  // when that article goes, status so a move between unread and Read Later
  // (same id, new group) is treated the same way rather than followed.
  const [selection, setSelection] = useState<Selection>();
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
  const selectedIndex = visible.findIndex(
    (article) => article.id === selection?.id,
  );

  const showNewArticles = () => {
    setSeenIds(new Set([...seenIds, ...idsOf(articles)]));
  };

  const selectAt = (index: number) => {
    const article = visible[index];
    setSelection(
      article ? { id: article.id, index, status: article.status } : undefined,
    );
  };

  if (selection !== undefined) {
    const sameArticleSameStatus =
      selectedIndex !== -1 &&
      visible[selectedIndex].status === selection.status;

    if (!sameArticleSameStatus) {
      // The selected article left the list (usually marked as read), or it's
      // still there but its status changed — it moved between unread and
      // Read Later. Either way, treat it as if it left its row: hand the
      // highlight to whatever article now occupies that row, so "n" carries
      // on from there instead of dragging the reader's place in triage down
      // into the other group along with the article. Nothing left to
      // highlight clears the selection.
      selectAt(Math.min(selection.index, visible.length - 1));
    } else if (selectedIndex !== selection.index) {
      // The same article, same status, sits on a different row now, because
      // held articles were shown or because something above it left the list.
      setSelection({ ...selection, index: selectedIndex });
    }
  }

  useHotkeys("p", () => {
    if (selectedIndex === -1) {
      return;
    }

    if (selectedIndex === 0) {
      setSelection(undefined);
      return;
    }

    selectAt(selectedIndex - 1);
  });

  useHotkeys("n", () => {
    if (selectedIndex === -1) {
      selectAt(0);
      return;
    }

    if (selectedIndex === visible.length - 1) {
      return;
    }

    selectAt(selectedIndex + 1);
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
          onClick={() => selectAt(index)}
          selected={index === selectedIndex}
        />
      ))}
    </div>
  );
};

export default ArticleList;
