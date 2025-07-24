"use client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { CircleCheckBigIcon, CircleIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ToggleReadButton = ({ article }: { article: Article }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkAsRead = async () => {
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);

    toast("Article marked as read", {
      description: (
        <>
          <span className="font-semibold italic">{article.title}</span> has been
          marked as read.
        </>
      ),
      action: {
        label: "Undo",
        onClick: () => handleMarkAsUnread(),
      },
    });
  };

  const handleMarkAsUnread = async () => {
    await unmarkArticleAsRead(article.id);
  };

  const renderTooltipButton = (
    Icon: React.ComponentType<{ className?: string }>,
    onClick: () => void,
    tooltipText: string,
  ) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={isSubmitting}
            size="sm"
            variant="outline"
            onClick={onClick}
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const isRead = article.readAt !== null;

  return renderTooltipButton(
    isRead ? CircleCheckBigIcon : CircleIcon,
    isRead ? handleMarkAsUnread : handleMarkAsRead,
    isRead ? "Mark as unread" : "Mark as read",
  );
};

export default ToggleReadButton;
