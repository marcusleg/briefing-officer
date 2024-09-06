import {
  markArticleAsReadLater,
  unmarkArticleAsReadLater,
} from "@/app/feed/[feedId]/actions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Article } from "@prisma/client";
import { BookmarkIcon } from "lucide-react";

interface ToggleReadLaterButtonProps {
  article: Article;
}

const ToggleReadLaterButton = ({ article }: ToggleReadLaterButtonProps) => {
  const handleReadLaterClick = async () => {
    await markArticleAsReadLater(article.id);
  };

  const handleRemoveFromReadLaterClick = async () => {
    await unmarkArticleAsReadLater(article.id);
  };

  if (article.readLater) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
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
        <TooltipTrigger>
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
