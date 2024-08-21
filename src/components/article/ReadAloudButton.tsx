"use client";

import { Button } from "@/components/ui/button";
import { Speech } from "lucide-react";
import { getSpeechSynthesis } from "@/lib/polly";

interface ReadAloudButtonProps {
  feedId: number;
  articleId: number;
}

const ReadAloudButton = ({ feedId, articleId }: ReadAloudButtonProps) => {
  const handleClick = async () => {
    await getSpeechSynthesis(feedId, articleId);
    // TODO play audio
  };

  return (
    <Button variant="outline" onClick={handleClick}>
      <Speech className="mr-2 h-4 w-4" />
      Read aloud
    </Button>
  );
};

export default ReadAloudButton;
