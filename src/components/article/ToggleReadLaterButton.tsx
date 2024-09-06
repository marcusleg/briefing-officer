import {
  markArticleAsReadLater,
  unmarkArticleAsReadLater,
} from "@/app/feed/[feedId]/actions";
import { Button } from "@/components/ui/button";
import { Article } from "@prisma/client";
import { BookmarkMinusIcon, BookmarkPlus } from "lucide-react";

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
      <Button
        onClick={handleRemoveFromReadLaterClick}
        size="sm"
        variant="outline"
      >
        <BookmarkMinusIcon className="mr-2 h-4 w-4" />
        Remove from read later
      </Button>
    );
  }

  return (
    <Button onClick={handleReadLaterClick} size="sm" variant="outline">
      <BookmarkPlus className="mr-2 h-4 w-4" />
      Read later
    </Button>
  );
};

export default ToggleReadLaterButton;
