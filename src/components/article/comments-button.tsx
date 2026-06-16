"use client";

import { buttonVariants } from "@/components/ui/button";
import { Article } from "@prisma/client";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

interface CommentsButtonProps {
  article: Pick<Article, "commentsLink">;
}

const CommentsButton = ({ article }: CommentsButtonProps) => {
  if (!article.commentsLink) return null;

  return (
    <Link
      className={buttonVariants({
        className: "text-sm",
        variant: "ghost",
      })}
      href={article.commentsLink}
      target="_blank"
      referrerPolicy="no-referrer"
    >
      <MessageSquare className="mr-1 size-4" />
      Comments
    </Link>
  );
};

export default CommentsButton;
