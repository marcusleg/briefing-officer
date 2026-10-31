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
  markArticleAsStarred,
  unmarkArticleAsStarred,
} from "@/lib/repository/articleRepository";
import { StarIcon } from "lucide-react";
import { toast } from "sonner";

const ToggleStarredButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const change = useArticleChange();

  const star = () =>
    change(article, { starred: true }, () => markArticleAsStarred(article.id));
  const unstar = () =>
    change(article, { starred: false }, () =>
      unmarkArticleAsStarred(article.id),
    );

  const handleStarClick = () => {
    star();

    toast("Article Starred", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: unstar },
    });
  };

  const handleUnstarClick = () => {
    unstar();

    toast("Article Unstarred", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: star },
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            onClick={article.starred ? handleUnstarClick : handleStarClick}
            className="cursor-pointer"
          >
            <StarIcon
              className={`size-4 ${article.starred ? "fill-black dark:fill-white" : "fill-transparent"}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{article.starred ? "Unstar" : "Star"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleStarredButton;
