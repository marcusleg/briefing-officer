"use client";
import { Button } from "@/components/ui/button";
import { Article } from "@/generated/prisma/client";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
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

  const handleMarkAsRead = async () => {
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);
    onAfterDismiss?.();

    toast("Article marked as read", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: () => handleMarkAsUnread() },
    });
  };

  const handleMarkAsUnread = async () => {
    setIsSubmitting(true);
    await unmarkArticleAsRead(article.id);
    setIsSubmitting(false);

    toast("Article marked as unread", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: () => handleMarkAsRead() },
    });
  };

  const isRead = article.readAt !== null;

  return (
    <Button
      className={className ?? "cursor-pointer justify-start text-sm"}
      disabled={isSubmitting}
      onClick={isRead ? handleMarkAsUnread : handleMarkAsRead}
      variant="secondary"
    >
      {isRead ? (
        <>
          <ArchiveRestoreIcon className="size-4" />
          Restore
        </>
      ) : (
        <>
          <CheckIcon className="size-4" />
          Dismiss
        </>
      )}
    </Button>
  );
};

export default DismissButton;
