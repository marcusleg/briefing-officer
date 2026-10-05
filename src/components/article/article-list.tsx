"use client";

import ArticleCard from "@/components/article/article-card";
import ArticleListGroup, {
  rowAttributes,
  rowKey,
  useArticleListGroup,
} from "@/components/article/article-list-group";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { Prisma } from "@/generated/prisma/client";
import { ArrowUpIcon } from "lucide-react";
import { useId, useLayoutEffect, useState } from "react";

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
 *
 * Selection and the "n"/"p" hotkeys belong to the enclosing
 * `ArticleListGroup`. A list rendered on its own forms a group by itself.
 */
const ArticleList = (props: ArticleListProps) => {
  if (!useArticleListGroup()) {
    return (
      <ArticleListGroup>
        <GroupedArticleList {...props} />
      </ArticleListGroup>
    );
  }

  return <GroupedArticleList {...props} />;
};

const GroupedArticleList = ({ articles }: ArticleListProps) => {
  const group = useArticleListGroup()!;
  const list = useId();
  const { userRefreshActive } = useLiveUpdates();
  const [seenIds, setSeenIds] = useState(() => new Set(idsOf(articles)));

  // An article another list in the group already showed is not new here:
  // moving it to Read Later must not hide it behind "Show 1 new article".
  const isSeen = (article: ListedArticle) =>
    seenIds.has(article.id) || group.seenIds.has(article.id);

  const unseen = articles.filter((article) => !isSeen(article));

  // The reader asked for this refresh, so its articles are what they want to
  // see. Adjusting state during render is React's pattern for deriving state
  // from a prop change without a flash of the intermediate render.
  if (userRefreshActive && unseen.length > 0) {
    setSeenIds(new Set([...seenIds, ...idsOf(unseen)]));
  }

  const visible = articles.filter(isSeen);

  const { markSeen, sync } = group;
  useLayoutEffect(() => markSeen(seenIds), [markSeen, seenIds]);
  // Rows may have come, gone or moved; the group checks its selection.
  useLayoutEffect(sync);

  const showNewArticles = () => {
    setSeenIds(new Set([...seenIds, ...idsOf(articles)]));
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col space-y-6">
      {unseen.length > 0 && (
        <Button
          className="cursor-pointer self-center"
          onClick={showNewArticles}
          variant="outline"
        >
          <ArrowUpIcon className="size-4" />
          Show {unseen.length} new{" "}
          {unseen.length === 1 ? "article" : "articles"}
        </Button>
      )}

      {visible.map((article) => {
        const row = rowKey(list, article.id);

        return (
          <div key={article.id} {...rowAttributes(row)}>
            <ArticleCard
              article={article}
              onClick={() => group.select(row)}
              selected={group.isSelected(row)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ArticleList;
