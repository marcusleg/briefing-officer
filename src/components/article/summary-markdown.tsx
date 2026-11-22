import type { SafeMarkdownProps } from "@/components/markdown/safe-markdown";
import { cn } from "@/lib/utils";
import { createElement, type HTMLAttributes } from "react";
import type { ExtraProps } from "streamdown";

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
export const summaryComponents: SafeMarkdownProps["components"] = {
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
