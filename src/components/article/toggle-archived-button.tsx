import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Article } from "@/generated/prisma/client";
import {
  archiveArticle,
  unarchiveArticle,
} from "@/lib/repository/articleRepository";
import { ArchiveIcon } from "lucide-react";
import { toast } from "sonner";

const ToggleArchivedButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const handleArchiveClick = async () => {
    await archiveArticle(article.id);

    toast("Article Archived", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: async () => await unarchiveArticle(article.id),
      },
    });
  };

  const handleUnarchiveClick = async () => {
    await unarchiveArticle(article.id);

    toast("Article Unarchived", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: async () => await archiveArticle(article.id),
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
              article.archived ? handleUnarchiveClick : handleArchiveClick
            }
            className="cursor-pointer"
          >
            <ArchiveIcon
              className={`size-4 ${article.archived ? "fill-current" : "fill-transparent"}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {article.archived ? "Unarchive" : "Archive"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleArchivedButton;
