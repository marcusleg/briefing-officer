"use client";
import { Button } from "@/components/ui/button";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { EyeIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ToggleReadButton = ({
  article,
  className,
}: {
  article: Article;
  className?: string;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkAsRead = async () => {
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);

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
          <EyeIcon className="size-4" />
          Restore
        </>
      ) : (
        <>
          <Trash2Icon className="size-4" />
          Dismiss
        </>
      )}
    </Button>
  );
};

export default ToggleReadButton;
