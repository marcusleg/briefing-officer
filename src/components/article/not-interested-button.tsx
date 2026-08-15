"use client";

import KeywordListField from "@/components/feed/keyword-list-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Article } from "@/generated/prisma/client";
import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";
import {
  markArticleAsNotInteresting,
  restoreArticleStatus,
} from "@/lib/repository/articleRepository";
import {
  addFeedFilter,
  removeFeedFilter,
} from "@/lib/repository/feedRepository";
import { ThumbsDownIcon } from "lucide-react";
import { useState } from "react";

type SuggestionState =
  | { status: "generating" }
  | { status: "ready"; suggestions: string[] }
  | { status: "unavailable" };

const NotInterestedButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const [open, setOpen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(article.status);
  const [suggestions, setSuggestions] = useState<SuggestionState>({
    status: "generating",
  });
  const [added, setAdded] = useState<string[]>([]);

  // The dismissal commits here, before the popover has taught anything.
  // Escaping the popover therefore leaves the article dismissed and the filter
  // untouched, which is the intended split: the popover is about the filter,
  // never about the article.
  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      return;
    }

    setPreviousStatus(article.status);
    setSuggestions({ status: "generating" });
    setAdded([]);

    await markArticleAsNotInteresting(article.id);

    try {
      const generated = await suggestFilterKeywords(article.id);
      setSuggestions({ status: "ready", suggestions: generated });
    } catch {
      // Not an error the reader has to act on — the manual input below is
      // unaffected, and the article is already dismissed.
      setSuggestions({ status: "unavailable" });
    }
  };

  const handleKeywordsChange = async (next: string[]) => {
    const inserted = next.find((entry) => !added.includes(entry));
    const removed = added.find((entry) => !next.includes(entry));

    setAdded(next);

    if (inserted) {
      await addFeedFilter(article.feedId, "DISINTEREST", inserted);
    }

    if (removed) {
      await removeFeedFilter(article.feedId, "DISINTEREST", removed);
    }
  };

  const unusedSuggestions =
    suggestions.status === "ready"
      ? suggestions.suggestions.filter((entry) => !added.includes(entry))
      : [];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          className="cursor-pointer"
          aria-label="Not interested"
        >
          <ThumbsDownIcon className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex w-80 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Marked as not interested</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto cursor-pointer p-0"
            onClick={async () => {
              await restoreArticleStatus(article.id, previousStatus);
              setOpen(false);
            }}
          >
            Undo
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Stop showing articles like this one:
        </p>

        {suggestions.status === "generating" && (
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        )}

        {suggestions.status === "unavailable" && (
          <p className="text-muted-foreground text-sm italic">
            No suggestions available — add one yourself below.
          </p>
        )}

        {unusedSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {unusedSuggestions.map((suggestion) => (
              <Badge key={suggestion} asChild variant="outline">
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => handleKeywordsChange([...added, suggestion])}
                >
                  {suggestion}
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Rendered in every state, never only as a fallback: a reader who
            wants to type their own should not have to wait for the model, and
            must still be able to filter when there is no model at all. */}
        <KeywordListField
          inputLabel="Add a keyword"
          onChange={handleKeywordsChange}
          placeholder="press releases"
          value={added}
        />

        <p className="text-muted-foreground text-xs">
          Applies to future articles.
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default NotInterestedButton;
