"use client";
import {
  markArticleAsRead,
  markArticleAsUnread,
} from "@/app/feed/[feedId]/actions";
import { Button } from "@/components/ui/button";
import { BookCheck, BookX } from "lucide-react";

const ToggleReadButton = ({
  articleId,
  isRead,
}: {
  articleId: number;
  isRead: boolean;
}) => {
  if (isRead) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => markArticleAsUnread(articleId)}
      >
        <BookX className="mr-2 h-4 w-4" />
        Mark as unread
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => markArticleAsRead(articleId)}
    >
      <BookCheck className="mr-2 h-4 w-4" />
      Mark as read
    </Button>
  );
};

export default ToggleReadButton;
