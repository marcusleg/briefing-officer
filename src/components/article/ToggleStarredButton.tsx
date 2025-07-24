import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  markArticleAsStarred,
  unmarkArticleAsStarred,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { StarIcon } from "lucide-react";
import { toast } from "sonner";

interface ToggleStarredButtonProps {
  article: Article;
}

const ToggleStarredButton = ({ article }: ToggleStarredButtonProps) => {
  const handleStarClick = async () => {
    await markArticleAsStarred(article.id);

    toast("Article Starred", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          add to the Read Later list..
        </>
      ),
      action: {
        label: "Undo",
        onClick: async () => await unmarkArticleAsStarred(article.id),
      },
    });
  };

  const handleUnstarClick = async () => {
    await unmarkArticleAsStarred(article.id);

    toast("Article Unstarred", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          removed from the Read Later list..
        </>
      ),
      action: {
        label: "Undo",
        onClick: async () => await markArticleAsStarred(article.id),
      },
    });
  };

  if (article.starred) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleUnstarClick} size="sm" variant="outline">
              <StarIcon className="h-4 w-4" fill="black" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Unstar</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={handleStarClick} size="sm" variant="outline">
            <StarIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Star</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleStarredButton;
