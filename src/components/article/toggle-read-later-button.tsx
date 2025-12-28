import { Button } from "@/components/ui/button";
import {
  markArticleAsReadLater,
  unmarkArticleAsReadLater,
} from "@/lib/repository/articleRepository";
import { BookmarkIcon } from "lucide-react";
import { toast } from "sonner";
import { Article } from "../../../prisma/generated/prisma/client";

interface ToggleReadLaterButtonProps {
  article: Article;
}

const ToggleReadLaterButton = ({ article }: ToggleReadLaterButtonProps) => {
  const handleReadLaterClick = async () => {
    await markArticleAsReadLater(article.id);

    toast("Article Added To Read Later", {
      description: (
        <>
          <span className="italic">{article.title}</span>
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
          <span className="italic">{article.title}</span>
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
      className="cursor-pointer text-xs"
    >
      <BookmarkIcon
        className="mr-1 size-4"
        fill={article.readLater ? "black" : "transparent"}
      />
      Read Later
    </Button>
  );
};

export default ToggleReadLaterButton;
