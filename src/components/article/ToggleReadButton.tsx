"use client";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { CircleCheckBigIcon, CircleIcon } from "lucide-react";

const ToggleReadButton = ({ article }: { article: Article }) => {
  const { toast } = useToast();

  const handleMarkAsRead = async () => {
    await markArticleAsRead(article.id);

    toast({
      title: "Article marked as read",
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          marked as read.
        </>
      ),
      action: (
        <ToastAction altText={"Undo"} onClick={handleMarkAsUnread}>
          Undo
        </ToastAction>
      ),
    });
  };

  const handleMarkAsUnread = async () => {
    await unmarkArticleAsRead(article.id);
  };

  if (article.readAt !== null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Button size="sm" variant="outline" onClick={handleMarkAsUnread}>
              <CircleCheckBigIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark as unread</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button size="sm" variant="outline" onClick={handleMarkAsRead}>
            <CircleIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mark as read</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ToggleReadButton;
