"use client";
import { Button } from "@/components/ui/button";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ToggleReadButton = ({ article }: { article: Article }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkAsRead = async () => {
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);

    toast("Article marked as read", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          marked as read.
        </>
      ),
      action: {
        label: "Undo",
        onClick: () => handleMarkAsUnread(),
      },
    });
  };

  const handleMarkAsUnread = async () => {
    setIsSubmitting(true);
    await unmarkArticleAsRead(article.id);
    setIsSubmitting(false);

    toast("Article marked as unread", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          marked as read.
        </>
      ),
      action: {
        label: "Undo",
        onClick: () => handleMarkAsRead(),
      },
    });
  };

  const isRead = article.readAt !== null;

  return (
    <Button
      className="text-xs"
      disabled={isSubmitting}
      onClick={isRead ? handleMarkAsUnread : handleMarkAsRead}
      size="sm"
      variant="ghost"
    >
      {isRead ? (
        <EyeOffIcon className="mr-1 h-4 w-4" />
      ) : (
        <EyeIcon className="mr-1 h-4 w-4" />
      )}
      {isRead ? "Mark Unread" : "Mark Read"}
    </Button>
  );
};

export default ToggleReadButton;
