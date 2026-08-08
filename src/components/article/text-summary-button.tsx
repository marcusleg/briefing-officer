import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

interface TextSummaryButtonProps {
  feedId: number;
  articleId: number;
  className?: string;
}

const TextSummaryButton = ({
  feedId,
  articleId,
  className,
}: TextSummaryButtonProps) => {
  return (
    <Button
      asChild
      variant="secondary"
      className={className ?? "justify-start text-sm"}
      aria-label="Text summary"
    >
      <Link href={`/feed/${feedId}/article/${articleId}/text-summary`}>
        <Sparkles className="mr-1 size-4" />
        Summarize
      </Link>
    </Button>
  );
};

export default TextSummaryButton;
