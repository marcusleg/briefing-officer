"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { markArticleAsRead } from "@/lib/repository/articleRepository";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Article } from "../../../prisma/generated/prisma/client";

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
      <ExternalLink className="mr-1 size-4" />
      Visit Original
    </Link>
  );
};

export default VisitButton;
