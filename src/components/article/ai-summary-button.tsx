import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import React from "react";

interface AiSummaryButtonProps {
  feedId: number;
  articleId: number;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

const AiSummaryButton = ({ feedId, articleId, size, className }: AiSummaryButtonProps) => {
  return (
    <Button
      asChild
      variant="secondary"
      className={className ?? "justify-start text-sm"}
    >
      <Link href={`/feed/${feedId}/article/${articleId}/ai-summary`}>
        <Sparkles className="mr-1 size-4" />
        Summarize
      </Link>
    </Button>
  );
};

export default AiSummaryButton;
