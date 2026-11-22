"use client";

import { summaryComponents } from "@/components/article/summary-markdown";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { streamTextSummary } from "@/lib/ai/services/textSummaryService";
import { readStreamableValue } from "@ai-sdk/rsc";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

interface TextSummaryStreamProps {
  articleId: number;
}

const TextSummaryStream = ({ articleId }: TextSummaryStreamProps) => {
  const initialized = useRef(false);
  const [generation, setGeneration] = useState<string>("");
  const [status, setStatus] = useState<"streaming" | "done" | "failed">(
    "streaming",
  );

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
        setStatus("done");
      } catch {
        // Whatever arrived before the failure stays on screen; only the rest of
        // the summary is missing.
        setStatus("failed");
      }
    };

    void streamSummary();
  }, [articleId]);

  if (status === "streaming" && generation === "") {
    return (
      <Spinner
        className="mx-auto my-12 size-8"
        aria-label="Writing text summary"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {status === "failed" && (
        <Alert>
          <AlertTitle>Text summary incomplete</AlertTitle>
          <AlertDescription>
            The rest of this text summary could not be generated. What was
            written is shown below.
          </AlertDescription>
        </Alert>
      )}

      <SafeMarkdown
        className="flex flex-col gap-4 space-y-0 [&>*]:my-0"
        components={summaryComponents}
        isAnimating={status === "streaming"}
      >
        {generation}
      </SafeMarkdown>
    </div>
  );
};

export default TextSummaryStream;
