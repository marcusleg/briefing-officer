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
import { CircleCheckBigIcon, CircleIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";

const ToggleReadButton = ({ article }: { article: Article }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleMarkAsRead = async () => {
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);

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
