import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  markArticleAsReadLater,
  unmarkArticleAsReadLater,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { BookmarkIcon } from "lucide-react";
import { toast } from "sonner";

const ToggleReadLaterButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const handleReadLaterClick = async () => {
    await markArticleAsReadLater(article.id);

    toast("Article Added To Read Later", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: async () => await unmarkArticleAsReadLater(article.id),
      },
    });
  };

  const handleRemoveFromReadLaterClick = async () => {
    await unmarkArticleAsReadLater(article.id);

    toast("Article Removed From Read Later", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: async () => await markArticleAsReadLater(article.id),
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
            onClick={
              article.readLater
                ? handleRemoveFromReadLaterClick
                : handleReadLaterClick
            }
            className="cursor-pointer"
          >
            <BookmarkIcon
              className={`size-4 ${article.readLater ? "fill-black dark:fill-white" : "fill-transparent"}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {article.readLater ? "Remove from Read Later" : "Read Later"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleReadLaterButton;
