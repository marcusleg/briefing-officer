"use client";

import {
  SafeMarkdown,
  type SafeMarkdownProps,
} from "@/components/markdown/safe-markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { streamTextSummary } from "@/lib/ai/services/summaryService";
import { cn } from "@/lib/utils";
import { readStreamableValue } from "@ai-sdk/rsc";
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import type { ExtraProps } from "streamdown";

export const maxDuration = 30;

type Tag =
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "ul" | "ol" | "strong";

/**
 * A plain element with the summary's classes. Streamdown passes its syntax
 * tree node, which stays off the DOM.
 */
const styled = (tag: Tag, classes: string) => {
  const Styled = ({
    node: _node,
    className,
    ...props
  }: HTMLAttributes<HTMLElement> & ExtraProps) =>
    createElement(tag, { ...props, className: cn(classes, className) });
  Styled.displayName = `Summary${tag.toUpperCase()}`;
  return Styled;
};

const proseClasses = "text-prose text-justify hyphens-auto";

// Streamdown spaces list items with `py-1` on each `li`; the `[&>li]`
// classes here outrank it.
const listClasses = `${proseClasses} ml-6 [&>li]:mt-2 [&>li]:py-0`;

/**
 * Plain elements in place of Streamdown's defaults, whose heading margins and
 * inside list markers would add to the summary's `gap-4` rhythm and indent.
 */
const summaryComponents: SafeMarkdownProps["components"] = {
  h1: styled(
    "h1",
    "text-[1.44rem] leading-tight font-bold tracking-[-0.01em] text-balance",
  ),
  h2: styled("h2", "text-[1.2rem] leading-snug font-semibold"),
  h3: styled("h3", "text-base font-semibold"),
  h4: styled("h4", "text-base font-semibold"),
  h5: styled("h5", "text-base font-semibold"),
  h6: styled("h6", "text-base font-semibold"),
  p: styled("p", proseClasses),
  ul: styled("ul", `${listClasses} list-disc`),
  ol: styled("ol", `${listClasses} list-decimal`),
  // Streamdown renders bold as a semibold `span`; the key entity the summary
  // bolds in each bullet stays a `strong`, a step heavier than headings.
  strong: styled("strong", "font-bold"),
};

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
