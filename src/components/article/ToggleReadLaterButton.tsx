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

  if (article.readLater) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleRemoveFromReadLaterClick}
              size="sm"
              variant="outline"
            >
              <BookmarkIcon className="h-4 w-4" fill="black" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove from Read Later</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={handleReadLaterClick} size="sm" variant="outline">
            <BookmarkIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Read Later</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleReadLaterButton;
