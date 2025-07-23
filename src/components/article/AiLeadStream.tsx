"use client";

import { streamAiLead } from "@/lib/ai";
import { readStreamableValue } from "@ai-sdk/rsc";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

interface AiLeadStreamProps {
  articleId: number;
}

const AiLeadStream = ({ articleId }: AiLeadStreamProps) => {
  const initialized = useRef(false);
  const [generation, setGeneration] = useState<string>("");

  useEffect(() => {
    if (initialized.current) return; // Prevent multiple streams

    const streamLead = async () => {
      initialized.current = true;
      setGeneration(""); // Reset state

      const { output } = await streamAiLead(articleId);

      for await (const delta of readStreamableValue(output)) {
        setGeneration((currentGeneration) => `${currentGeneration}${delta}`);
      }
    };

    void streamLead();
  }, [articleId]);

  return <>{generation}</>;
};

export default AiLeadStream;
