"use client";

import { markArticleAsRead } from "@/app/feed/[feedId]/actions";
import { Button, buttonVariants } from "@/components/ui/button";
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
        size: size ? size : "default",
        variant: "outline",
      })}
      href={article.link}
      onClick={() => markArticleAsRead(article.id)}
      onAuxClick={() => markArticleAsRead(article.id)}
      referrerPolicy="no-referrer"
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Visit
    </Link>
  );
};

export default VisitButton;
