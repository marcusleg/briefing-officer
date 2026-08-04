import { Button } from "@/components/ui/button";
import { Volume2Icon } from "lucide-react";
import Link from "next/link";

interface AudioSummaryButtonProps {
  feedId: number;
  articleId: number;
  variant?: "secondary" | "ghost";
}

const AudioSummaryButton = ({
  feedId,
  articleId,
  variant = "secondary",
}: AudioSummaryButtonProps) => (
  <Button asChild variant={variant} size="icon" aria-label="Audio summary">
    <Link href={`/feed/${feedId}/article/${articleId}/audio-summary`}>
      <Volume2Icon className="size-4" />
    </Link>
  </Button>
);

export default AudioSummaryButton;
