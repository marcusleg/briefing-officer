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

const ToggleStarredButton = ({ article, variant = "secondary" }: { article: Article; variant?: "secondary" | "ghost" }) => {
  const handleStarClick = async () => {
    await markArticleAsStarred(article.id);

    toast("Article Starred", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: async () => await unmarkArticleAsStarred(article.id) },
    });
  };

  const handleUnstarClick = async () => {
    await unmarkArticleAsStarred(article.id);

    toast("Article Unstarred", {
      description: <span className="italic">{article.title}</span>,
      action: { label: "Undo", onClick: async () => await markArticleAsStarred(article.id) },
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
