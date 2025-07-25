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

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={article.starred ? handleUnstarClick : handleStarClick}
      className="text-xs"
    >
      <StarIcon
        className="mr-1 h-4 w-4"
        fill={article.starred ? "black" : "transparent"}
      />
      {article.starred ? "Unstar" : "Star"}
    </Button>
  );
};

export default ToggleStarredButton;
