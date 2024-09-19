"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateAiLead } from "@/lib/ai";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

interface AiLeadButtonProps {
  articleId: number;
}

const AiLeadButton = ({ articleId }: AiLeadButtonProps) => {
  const { toast } = useToast();

  const [leadGenerationInProgress, setLeadGenerationInProgress] =
    useState(false);

  const handleClick = async () => {
    setLeadGenerationInProgress(true);

    try {
      await generateAiLead(articleId);
    } catch (error) {
      toast({
        title: "Failed to generate AI lead",
        description: "Please check the server logs to find out more.",
        variant: "destructive",
      });
    }

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
