"use client";
import { useArticleChange } from "@/components/article/article-overrides";
import { Button } from "@/components/ui/button";
import { Article, ArticleStatus } from "@/generated/prisma/client";
import { isInInbox } from "@/lib/article";
import {
  markArticleAsRead,
  restoreArticleStatus,
  restoreArticleToInbox,
} from "@/lib/repository/articleRepository";
import { ArchiveRestoreIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

const DismissButton = ({
  article,
  className,
  onAfterDismiss,
}: {
  article: Article;
  className?: string;
  onAfterDismiss?: () => void;
}) => {
  const change = useArticleChange();
  const isInbox = isInInbox(article.status);

  const undoTo = (previous: ArticleStatus) => ({
    label: "Undo",
    onClick: () =>
      change(article, { status: previous }, () =>
        restoreArticleStatus(article.id, previous),
      ),
  });

  const handleMarkAsRead = () => {
    const previous = article.status;
    change(article, { status: "READ" }, () => markArticleAsRead(article.id));
    onAfterDismiss?.();

    toast("Article marked as read", {
      description: <span className="italic">{article.title}</span>,
      action: undoTo(previous),
    });
  };

  const handleRestore = () => {
    const previous = article.status;
    change(article, { status: "UNREAD" }, () =>
      restoreArticleToInbox(article.id),
    );

    toast("Article restored to your inbox", {
      description: <span className="italic">{article.title}</span>,
      action: undoTo(previous),
    });
  };

  return (
    <Button
      className={className ?? "cursor-pointer justify-start text-sm"}
      onClick={isInbox ? handleMarkAsRead : handleRestore}
      variant="secondary"
    >
      {isInbox ? (
        <>
          <CheckIcon className="size-4" />
          Dismiss
        </>
      ) : (
        <>
          <ArchiveRestoreIcon className="size-4" />
          Restore
        </>
      )}
    </Button>
  );
};

export default DismissButton;
