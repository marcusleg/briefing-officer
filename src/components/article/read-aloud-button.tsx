"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { SquareIcon, Volume2Icon } from "lucide-react";

interface ReadAloudButtonProps {
  text: string;
  title: string;
  variant?: "secondary" | "ghost";
}

const ReadAloudButton = ({
  text,
  title,
  variant = "secondary",
}: ReadAloudButtonProps) => {
  const { cancel, speak, speaking, supported } = useSpeechSynthesis();

  // Without a speech engine the button would silently do nothing when pressed,
  // so hide it rather than render a dead control.
  if (!supported) {
    return null;
  }

  const label = speaking ? "Stop reading" : "Read aloud";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            aria-label={label}
            onClick={() => (speaking ? cancel() : speak(`${title}. ${text}`))}
            className="cursor-pointer"
          >
            {speaking ? (
              <SquareIcon className="size-4 fill-current" />
            ) : (
              <Volume2Icon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ReadAloudButton;
