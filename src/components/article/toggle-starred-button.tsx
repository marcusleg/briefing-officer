import { Button } from "@/components/ui/button";
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
          <span className="italic">{article.title}</span>
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
          <span className="italic">{article.title}</span>
        </>
      ),
      action: {
        label: "Undo",
        onClick: async () => await markArticleAsStarred(article.id),
      },
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={article.starred ? handleUnstarClick : handleStarClick}
      className="cursor-pointer text-xs"
    >
      <StarIcon
        className={`mr-1 size-4 ${article.starred ? "fill-black dark:fill-white" : "fill-transparent"}`}
      />
      {article.starred ? "Starred" : "Star"}
    </Button>
  );
};

export default ToggleStarredButton;
