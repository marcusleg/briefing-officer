"use client";

import { useArticleChange } from "@/components/article/article-overrides";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Article } from "@/generated/prisma/client";
import {
  markArticleAsReadLater,
  unmarkArticleAsReadLater,
} from "@/lib/repository/articleRepository";
import { BookmarkIcon } from "lucide-react";
import { toast } from "sonner";

const ToggleReadLaterButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const change = useArticleChange();
  const isReadLater = article.status === "READ_LATER";

  const addToReadLater = () =>
    change(article, { status: "READ_LATER" }, () =>
      markArticleAsReadLater(article.id),
    );
  const removeFromReadLater = () =>
    change(article, { status: "UNREAD" }, () =>
      unmarkArticleAsReadLater(article.id),
    );

  const handleReadLaterClick = () => {
    addToReadLater();

    toast("Article Added To Read Later", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: removeFromReadLater },
    });
  };

  const handleRemoveFromReadLaterClick = () => {
    removeFromReadLater();

    toast("Article Removed From Read Later", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: addToReadLater },
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            onClick={
              isReadLater
                ? handleRemoveFromReadLaterClick
                : handleReadLaterClick
            }
            className="cursor-pointer"
          >
            <BookmarkIcon
              className={`size-4 ${isReadLater ? "fill-black dark:fill-white" : "fill-transparent"}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isReadLater ? "Remove from Read Later" : "Read Later"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleReadLaterButton;
