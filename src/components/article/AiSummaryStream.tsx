"use client";

import Typography from "@/components/ui/typography";
import { streamAiSummary } from "@/lib/ai";
import { readStreamableValue } from "@ai-sdk/rsc";
import Markdown from "markdown-to-jsx";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

interface AiSummaryStreamProps {
  articleId: number;
}

const AiSummaryStream = ({ articleId }: AiSummaryStreamProps) => {
  const initialized = useRef(false);
  const [generation, setGeneration] = useState<string>("");

  useEffect(() => {
    if (initialized.current) return; // Prevent multiple streams

    const streamSummary = async () => {
      initialized.current = true;
      setGeneration(""); // Reset state

      const { output } = await streamAiSummary(articleId);

      for await (const delta of readStreamableValue(output)) {
        setGeneration((currentGeneration) => `${currentGeneration}${delta}`);
      }
    };

    void streamSummary();
  }, [articleId]);

  return (
    <Markdown
      className="flex flex-col gap-4"
      options={{
        overrides: {
          h1: {
            component: Typography,
            props: { variant: "h1" },
          },
          h2: {
            component: Typography,
            props: { variant: "h2" },
          },
          h3: {
            component: Typography,
            props: { variant: "h3" },
          },
          h4: {
            component: Typography,
            props: { variant: "h4" },
          },
          h5: {
            component: Typography,
            props: { variant: "h5" },
          },
          h6: {
            component: Typography,
            props: { variant: "h6" },
          },
          ul: {
            component: Typography,
            props: { variant: "ul" },
          },
          ol: {
            component: Typography,
            props: { variant: "ol" },
          },
          p: {
            component: Typography,
            props: {
              className: "hyphens-auto text-pretty text-justify",
              variant: "p",
            },
          },
        },
      }}
    >
      {generation}
    </Markdown>
  );
};

export default AiSummaryStream;
