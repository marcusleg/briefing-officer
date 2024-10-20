import { Button, buttonVariants } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import React from "react";

interface AiSummaryButtonProps {
  feedId: number;
  articleId: number;
  size?: React.ComponentProps<typeof Button>["size"];
}

const AiSummaryButton = ({ feedId, articleId, size }: AiSummaryButtonProps) => {
  return (
    <Link
      className={buttonVariants({
        size: size ? size : "default",
        variant: "outline",
      })}
      href={`/feed/${feedId}/article/${articleId}/ai-summary`}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      AI Summary
    </Link>
  );
};

export default AiSummaryButton;
