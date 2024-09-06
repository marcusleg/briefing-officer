import {
  markArticleAsStarred,
  unmarkArticleAsStarred,
} from "@/app/feed/[feedId]/actions";
import { Button } from "@/components/ui/button";
import { Article } from "@prisma/client";
import { StarIcon, StarOffIcon } from "lucide-react";

interface ToggleStarredButtonProps {
  article: Article;
}

const ToggleStarredButton = ({ article }: ToggleStarredButtonProps) => {
  const handleStarClick = async () => {
    await markArticleAsStarred(article.id);
  };

  const handleUnstarClick = async () => {
    await unmarkArticleAsStarred(article.id);
  };

  if (article.starred) {
    return (
      <Button onClick={handleUnstarClick} size="sm" variant="outline">
        <StarOffIcon className="mr-2 h-4 w-4" />
        Unstar
      </Button>
    );
  }

  return (
    <Button onClick={handleStarClick} size="sm" variant="outline">
      <StarIcon className="mr-2 h-4 w-4" />
      Star
    </Button>
  );
};

export default ToggleStarredButton;
