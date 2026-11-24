"use client";

import { MessageAction } from "@/components/ai-elements/message";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** How long the button shows that the answer was copied. */
const COPIED_FOR_MS = 2000;

/**
 * The button that copies a chat answer's Markdown to the clipboard, so
 * pasting it elsewhere keeps its headings, lists and links.
 */
export const CopyAnswer = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(reset.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    } catch {
      toast.error("This answer could not be copied.", { id: "chat-copy" });
    }
  };

  return (
    <MessageAction
      label={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : "Copy"}
      onClick={() => void copy()}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </MessageAction>
  );
};
