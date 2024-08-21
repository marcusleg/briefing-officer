"use client";

import { Button } from "@/components/ui/button";
import { getAiLead } from "@/app/feed/[feedId]/[articleId]/ai-summary/actions";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

interface AiLeadButtonProps {
  feedId: number;
  articleId: number;
}

const AiLeadButton = ({ feedId, articleId }: AiLeadButtonProps) => {
  const [leadGenerationInProgress, setLeadGenerationInProgress] =
    useState(false);

  const handleClick = async () => {
    setLeadGenerationInProgress(true);
    await getAiLead(feedId, articleId);
    setLeadGenerationInProgress(false);
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={leadGenerationInProgress}
    >
      {leadGenerationInProgress ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      AI Lead
    </Button>
  );
};

export default AiLeadButton;
