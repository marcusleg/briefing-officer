"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { markArticleAsRead } from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

interface VisitButtonProps {
  article: Article;
  size?: React.ComponentProps<typeof Button>["size"];
}

const VisitButton = ({ article, size }: VisitButtonProps) => {
  return (
    <Link
      className={buttonVariants({
        className: "text-xs",
        size: "sm",
        variant: "ghost",
      })}
      href={article.link}
      onClick={() => markArticleAsRead(article.id)}
      onAuxClick={() => markArticleAsRead(article.id)}
      referrerPolicy="no-referrer"
    >
      <ExternalLink className="mr-1 h-4 w-4" />
      Visit Original
    </Link>
  );
};

export default VisitButton;
