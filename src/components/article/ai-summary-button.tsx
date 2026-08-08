import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

interface AiSummaryButtonProps {
  feedId: number;
  articleId: number;
  className?: string;
}

const AiSummaryButton = ({
  feedId,
  articleId,
  className,
}: AiSummaryButtonProps) => {
  return (
    <Button
      asChild
      variant="secondary"
      className={className ?? "justify-start text-sm"}
    >
      <Link href={`/feed/${feedId}/article/${articleId}/text-summary`}>
        <Sparkles className="mr-1 size-4" />
        Summarize
      </Link>
    </Button>
  );
};

export default AiSummaryButton;
