import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scrapeArticle } from "@/lib/scraper";
import { Prisma } from "@prisma/client";
import { EllipsisVerticalIcon, SquareCodeIcon } from "lucide-react";

interface AdditionArticleActionsButtonProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
}

const AdditionArticleActionsButton = ({
  article,
}: AdditionArticleActionsButtonProps) => {
  const handleScrapeArticle = async () => {
    await scrapeArticle(article.id, article.link, { forceScrape: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <EllipsisVerticalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Debug</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleScrapeArticle}>
          <SquareCodeIcon className="mr-2 h-4 w-4" />
          <span>(Re)scrape article</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdditionArticleActionsButton;
