"use client";

import { Button } from "@/components/ui/button";
import { generateAiLead } from "@/lib/ai";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

interface AiLeadButtonProps {
  articleId: number;
}

const AiLeadButton = ({ articleId }: AiLeadButtonProps) => {
  const [leadGenerationInProgress, setLeadGenerationInProgress] =
    useState(false);

  const handleClick = async () => {
    setLeadGenerationInProgress(true);
    await generateAiLead(articleId);
    setLeadGenerationInProgress(false);
  };

  return (
    <Button
      disabled={leadGenerationInProgress}
      size="sm"
      onClick={handleClick}
      variant="outline"
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
