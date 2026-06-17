"use client";

import { Button } from "@/components/ui/button";
import { markArticleAsRead } from "@/lib/repository/articleRepository";
import { Article } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

interface VisitButtonProps {
  article: Article;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

const VisitButton = ({ article, size, className }: VisitButtonProps) => {
  return (
    <Button
      asChild
      variant="default"
      className={className ?? "justify-start text-sm"}
    >
      <Link
        href={article.link}
        onClick={() => markArticleAsRead(article.id)}
        onAuxClick={() => markArticleAsRead(article.id)}
        referrerPolicy="no-referrer"
      >
        <ExternalLink className="mr-1 size-4" />
        Read
      </Link>
    </Button>
  );
};

export default VisitButton;
