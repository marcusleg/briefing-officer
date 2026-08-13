"use client";
import { Button } from "@/components/ui/button";
import { Article } from "@/generated/prisma/client";
import {
  markArticleAsRead,
  restoreArticleStatus,
  restoreArticleToInbox,
} from "@/lib/repository/articleRepository";
import { ArchiveRestoreIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInbox = article.status === "UNREAD";

  const handleMarkAsRead = async () => {
    const previous = article.status;
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);
    onAfterDismiss?.();

    toast("Article marked as read", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: () => restoreArticleStatus(article.id, previous),
      },
    });
  };

  const handleRestore = async () => {
    const previous = article.status;
    setIsSubmitting(true);
    await restoreArticleToInbox(article.id);
    setIsSubmitting(false);

    toast("Article restored to your inbox", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: () => restoreArticleStatus(article.id, previous),
      },
    });
  };

  return (
    <Button
      className={className ?? "cursor-pointer justify-start text-sm"}
      disabled={isSubmitting}
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
