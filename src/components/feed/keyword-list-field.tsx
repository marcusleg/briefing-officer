"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sortKeywords } from "@/lib/feedFilters";
import { XIcon } from "lucide-react";
import { useState } from "react";

interface KeywordListFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Accessible name for the text input; each instance needs its own. */
  inputLabel: string;
}

const KeywordListField = ({
  value,
  onChange,
  disabled,
  placeholder,
  inputLabel,
}: KeywordListFieldProps) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();

    if (text === "") {
      return;
    }

    // Silently ignored rather than flagged: re-adding something already in the
    // list is a no-op the reader intended, not a mistake worth an error.
    const duplicate = value.some(
      (entry) => entry.toLowerCase() === text.toLowerCase(),
    );

    if (!duplicate) {
      onChange(sortKeywords([...value, text]));
    }

    setDraft("");
  };

  const sortedValue = sortKeywords(value);

  return (
    <div className="flex flex-col gap-2">
      {sortedValue.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sortedValue.map((entry) => (
            <Badge key={entry} variant="secondary" className="gap-1 pr-1">
              {entry}
              <button
                type="button"
                aria-label={`Remove ${entry}`}
                disabled={disabled}
                onClick={() =>
                  onChange(value.filter((current) => current !== entry))
                }
                className="cursor-pointer"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          aria-label={inputLabel}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Without this the Enter key submits the surrounding form instead
            // of adding the entry.
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          value={draft}
        />
        <Button
          className="cursor-pointer"
          disabled={disabled}
          onClick={add}
          type="button"
          variant="secondary"
        >
          Add
        </Button>
      </div>
    </div>
  );
};

export default KeywordListField;
