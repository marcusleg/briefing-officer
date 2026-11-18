"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

export type ChatToolPart = Extract<
  ChatUIMessage["parts"][number],
  { type: "tool-searchArticles" | "tool-getArticle" }
>;

/** One line telling the reader what the assistant looked at. */
export const describeToolActivity = (part: ChatToolPart): string => {
  if (part.type === "tool-searchArticles") {
    const terms = (part.input?.terms ?? [])
      .filter((term): term is string => typeof term === "string" && !!term)
      .join(", ");
    const from = part.input?.from;
    const to = part.input?.to;
    const range = from || to ? ` · ${from ?? "…"} – ${to ?? "today"}` : "";

    switch (part.state) {
      case "output-available":
        return "error" in part.output
          ? "Search failed"
          : `Searched: ${terms}${range}`;
      case "output-error":
        return "Search failed";
      default:
        return `Searching: ${terms}…`;
    }
  }

  switch (part.state) {
    case "output-available":
      return "error" in part.output
        ? "Article not found"
        : `Read: ${part.output.title}`;
    case "output-error":
      return "Could not open the article";
    default:
      return "Opening an article…";
  }
};

const MAX_RESULTS_SHOWN = 5;

const isFinished = (part: ChatToolPart) =>
  part.state === "output-available" || part.state === "output-error";

const foundTitles = (part: ChatToolPart): string[] => {
  if (
    part.type !== "tool-searchArticles" ||
    part.state !== "output-available" ||
    "error" in part.output
  ) {
    return [];
  }
  return part.output.results
    .slice(0, MAX_RESULTS_SHOWN)
    .map((result) => result.title);
};

/**
 * The assistant's searches and reads for one answer. Open while a step is
 * still running, collapsed once all are done; the reader can expand it.
 */
const ToolActivity = ({ parts }: { parts: ChatToolPart[] }) => {
  const active = parts.some((part) => !isFinished(part));
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);

  // Follow the steps: open when a new one starts, collapse when all finish.
  if (active !== wasActive) {
    setWasActive(active);
    setOpen(active);
  }

  return (
    <ChainOfThought open={open} onOpenChange={setOpen}>
      <ChainOfThoughtHeader>
        {active ? "Searching your articles…" : "Searched your articles"}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {parts.map((part) => {
          const titles = foundTitles(part);
          return (
            <ChainOfThoughtStep
              key={part.toolCallId}
              icon={SearchIcon}
              label={describeToolActivity(part)}
              status={isFinished(part) ? "complete" : "active"}
            >
              {titles.length > 0 && (
                <ChainOfThoughtSearchResults>
                  {titles.map((title, index) => (
                    <ChainOfThoughtSearchResult key={index}>
                      {title}
                    </ChainOfThoughtSearchResult>
                  ))}
                </ChainOfThoughtSearchResults>
              )}
            </ChainOfThoughtStep>
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
};

export default ToolActivity;
