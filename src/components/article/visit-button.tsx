"use client";

import { buttonVariants } from "@/components/ui/button";
import { markArticleAsRead } from "@/lib/repository/articleRepository";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Article } from "../../../prisma/generated/prisma/client";

interface VisitButtonProps {
  article: Article;
}

const VisitButton = ({ article }: VisitButtonProps) => {
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
