"use client";

import { Button } from "@/components/ui/button";
import { Article } from "@/generated/prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

interface VisitButtonProps {
  article: Article;
  className?: string;
}

const VisitButton = ({ article, className }: VisitButtonProps) => {
  return (
    <Button
      asChild
      variant="secondary"
      className={className ?? "justify-start text-sm"}
    >
      <Link href={article.link} referrerPolicy="no-referrer">
        <ExternalLink className="mr-1 size-4" />
        Read
      </Link>
    </Button>
  );
};

export default VisitButton;
