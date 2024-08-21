"use client";
import {
  markArticleAsRead,
  markArticleAsUnread,
} from "@/app/feed/[feedId]/actions";
import { BookCheck, BookX } from "lucide-react";
import { Button } from "@/components/ui/button";

const ToggleReadButton = ({
  feedId,
  articleId,
  isRead,
}: {
  feedId: number;
  articleId: number;
  isRead: boolean;
}) => {
  if (isRead) {
    return (
      <Button
        variant="outline"
        onClick={() => markArticleAsUnread(feedId, articleId)}
      >
        <BookX className="mr-2 h-4 w-4" />
        Mark as unread
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => markArticleAsRead(feedId, articleId)}
    >
      <BookCheck className="mr-2 h-4 w-4" />
      Mark as read
    </Button>
  );
};

export default ToggleReadButton;
