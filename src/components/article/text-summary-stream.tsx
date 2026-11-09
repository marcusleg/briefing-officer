"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { streamTextSummary } from "@/lib/ai/services/summaryService";
import { readStreamableValue } from "@ai-sdk/rsc";
import Markdown from "markdown-to-jsx";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

interface TextSummaryStreamProps {
  articleId: number;
}

const TextSummaryStream = ({ articleId }: TextSummaryStreamProps) => {
  const initialized = useRef(false);
  const [generation, setGeneration] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initialized.current) return; // Prevent multiple streams

    const streamSummary = async () => {
      initialized.current = true;
      setGeneration(""); // Reset state

      try {
        const { output } = await streamTextSummary(articleId);

        for await (const delta of readStreamableValue(output)) {
          setGeneration((currentGeneration) => `${currentGeneration}${delta}`);
        }
      } catch {
        // Whatever arrived before the failure stays on screen; only the rest of
        // the summary is missing.
        setFailed(true);
      }
    };

    void streamSummary();
  }, [articleId]);

  return (
    <div className="flex flex-col gap-4">
      {failed && (
        <Alert>
          <AlertTitle>Summary incomplete</AlertTitle>
          <AlertDescription>
            The rest of this summary could not be generated. What was written is
            shown below.
          </AlertDescription>
        </Alert>
      )}

      <Markdown
        className="flex flex-col gap-4"
        options={{
          overrides: {
            h1: {
              props: {
                className:
                  "text-[1.44rem] leading-tight font-bold tracking-[-0.01em] text-balance",
              },
            },
            h2: {
              props: { className: "text-[1.2rem] leading-snug font-semibold" },
            },
            h3: {
              props: { className: "text-base font-semibold" },
            },
            h4: {
              props: { className: "text-base font-semibold" },
            },
            h5: {
              props: { className: "text-base font-semibold" },
            },
            h6: {
              props: { className: "text-base font-semibold" },
            },
            ul: {
              props: {
                className:
                  "text-prose ml-6 list-disc text-justify hyphens-auto [&>li]:mt-2",
              },
            },
            ol: {
              props: {
                className:
                  "text-prose ml-6 list-decimal text-justify hyphens-auto [&>li]:mt-2",
              },
            },
            p: {
              props: {
                className: "text-prose text-justify hyphens-auto",
              },
            },
          },
        }}
      >
        {generation}
      </Markdown>
    </div>
  );
};

export default TextSummaryStream;
