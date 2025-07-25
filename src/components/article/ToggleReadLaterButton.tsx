import { Button } from "@/components/ui/button";
import {
  markArticleAsReadLater,
  unmarkArticleAsReadLater,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { BookmarkIcon } from "lucide-react";
import { toast } from "sonner";

interface ToggleReadLaterButtonProps {
  article: Article;
}

const ToggleReadLaterButton = ({ article }: ToggleReadLaterButtonProps) => {
  const handleReadLaterClick = async () => {
    await markArticleAsReadLater(article.id);

    toast("Article Added To Read Later", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          add to the Read Later list..
        </>
      ),
      action: {
        label: "Undo",
        onClick: async () => await unmarkArticleAsReadLater(article.id),
      },
    });
  };

  const handleRemoveFromReadLaterClick = async () => {
    await unmarkArticleAsReadLater(article.id);

    toast("Article Removed From Read Later", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          removed from the Read Later list..
        </>
      ),
      action: {
        label: "Undo",
        onClick: async () => await markArticleAsReadLater(article.id),
      },
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={
        article.readLater
          ? handleRemoveFromReadLaterClick
          : handleReadLaterClick
      }
      className="text-xs"
    >
      <BookmarkIcon
        className="mr-1 h-4 w-4"
        fill={article.readLater ? "black" : "transparent"}
      />
      Read Later
    </Button>
  );
};

export default ToggleReadLaterButton;
