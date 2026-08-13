"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Article } from "@/generated/prisma/client";
import {
  markArticleAsNotInteresting,
  restoreArticleStatus,
} from "@/lib/repository/articleRepository";
import { ThumbsDownIcon } from "lucide-react";
import { toast } from "sonner";

const NotInterestedButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const handleClick = async () => {
    const previous = article.status;
    await markArticleAsNotInteresting(article.id);

    toast("Marked as not interesting", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: () => restoreArticleStatus(article.id, previous),
      },
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            onClick={handleClick}
            className="cursor-pointer"
            aria-label="Not interested"
          >
            <ThumbsDownIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Not interested</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NotInterestedButton;
