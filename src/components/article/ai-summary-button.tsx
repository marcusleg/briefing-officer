import { buttonVariants } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

interface AiSummaryButtonProps {
  feedId: number;
  articleId: number;
}

const AiSummaryButton = ({ feedId, articleId }: AiSummaryButtonProps) => {
  return (
    <Link
      className={buttonVariants({
        className: "text-xs",
        size: "sm",
        variant: "ghost",
      })}
      href={`/feed/${feedId}/article/${articleId}/ai-summary`}
    >
      <Sparkles className="mr-1 size-4" />
      AI Summary
    </Link>
  );
};

export default AiSummaryButton;
