"use client";

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
            props: { className: "text-3xl font-bold tracking-tight" },
          },
          h2: {
            props: { className: "text-2xl font-bold tracking-tight" },
          },
          h3: {
            props: { className: "text-xl font-bold tracking-tight" },
          },
          h4: {
            props: { className: "text-lg font-bold tracking-tight" },
          },
          h5: {
            props: { className: "text-base font-bold tracking-tight" },
          },
          h6: {
            props: { className: "text-sm font-bold tracking-tight" },
          },
          ul: {
            props: { className: "ml-6 list-disc [&>li]:mt-2" },
          },
          ol: {
            props: { className: "ml-6 list-decimal [&>li]:mt-2" },
          },
          p: {
            props: {
              className: "hyphens-auto text-pretty text-justify leading-7",
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
