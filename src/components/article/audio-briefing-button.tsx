import { Button } from "@/components/ui/button";
import { Volume2Icon } from "lucide-react";
import Link from "next/link";

interface AudioBriefingButtonProps {
  feedId: number;
  articleId: number;
  variant?: "secondary" | "ghost";
}

const AudioBriefingButton = ({
  feedId,
  articleId,
  variant = "secondary",
}: AudioBriefingButtonProps) => (
  <Button asChild variant={variant} size="icon" aria-label="Audio briefing">
    <Link href={`/feed/${feedId}/article/${articleId}/audio-briefing`}>
      <Volume2Icon className="size-4" />
    </Link>
  </Button>
);

export default AudioBriefingButton;
