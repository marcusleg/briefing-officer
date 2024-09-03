"use client";
import {
  markArticleAsRead,
  markArticleAsUnread,
} from "@/app/feed/[feedId]/actions";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { Article } from "@prisma/client";
import { BookCheck, BookX } from "lucide-react";

const ToggleReadButton = ({ article }: { article: Article }) => {
  const { toast } = useToast();

  const handleMarkAsRead = async () => {
    await markArticleAsRead(article.id);

    toast({
      title: "Article marked as read",
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          marked as read.
        </>
      ),
      action: (
        <ToastAction altText={"Undo"} onClick={handleMarkAsUnread}>
          Undo
        </ToastAction>
      ),
    });
  };

  const handleMarkAsUnread = async () => {
    await markArticleAsUnread(article.id);
  };

  if (article.read) {
    return (
      <Button size="sm" variant="outline" onClick={handleMarkAsUnread}>
        <BookX className="mr-2 h-4 w-4" />
        Mark as unread
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleMarkAsRead}>
      <BookCheck className="mr-2 h-4 w-4" />
      Mark as read
    </Button>
  );
};

export default ToggleReadButton;
