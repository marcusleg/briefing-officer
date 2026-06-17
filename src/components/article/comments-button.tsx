"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Article } from "@prisma/client";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

interface CommentsButtonProps {
  article: Pick<Article, "commentsLink">;
  variant?: "secondary" | "ghost";
}

const CommentsButton = ({
  article,
  variant = "secondary",
}: CommentsButtonProps) => {
  if (!article.commentsLink) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant={variant}
            size="icon"
            className="cursor-pointer"
          >
            <Link
              href={article.commentsLink}
              target="_blank"
              referrerPolicy="no-referrer"
            >
              <MessageSquare className="size-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Comments</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CommentsButton;
