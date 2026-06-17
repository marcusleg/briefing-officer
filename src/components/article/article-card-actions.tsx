"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
import CommentsButton from "@/components/article/comments-button";
import ToggleReadButton from "@/components/article/toggle-read-button";
import ToggleReadLaterButton from "@/components/article/toggle-read-later-button";
import ToggleStarredButton from "@/components/article/toggle-starred-button";
import VisitButton from "@/components/article/visit-button";
import { Prisma } from "@prisma/client";
import { ClockIcon } from "lucide-react";

interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  hideSummarizeButton?: boolean;
  readingTime?: { text: string; minutes: number; time: number; words: number };
}

const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <>
    {/* Mobile: row 1 — reading time left, icon buttons right */}
    <div className="flex w-full items-center gap-2 md:hidden">
      {props.readingTime && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <ClockIcon className="size-3" />
          {props.readingTime.text}
        </span>
      )}
      <div className="grow" />
      <ToggleReadLaterButton article={props.article} variant="ghost" />
      <ToggleStarredButton article={props.article} variant="ghost" />
      <CommentsButton article={props.article} variant="ghost" />
    </div>

    {/* Mobile: row 2 — full-width labeled buttons */}
    <div className="flex w-full gap-2 md:hidden">
      <ToggleReadButton
        article={props.article}
        className="flex-1 justify-center text-sm"
      />
      {!props.hideSummarizeButton && (
        <AiSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          className="flex-1 justify-center text-sm"
        />
      )}
      <VisitButton
        article={props.article}
        className="flex-1 justify-center text-sm"
      />
    </div>

    {/* Desktop: single row */}
    <div className="hidden md:flex md:w-full md:items-center md:gap-2">
      {props.readingTime && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <ClockIcon className="size-3" />
          {props.readingTime.text}
        </span>
      )}
      <div className="grow" />
      <ToggleReadLaterButton article={props.article} />
      <ToggleStarredButton article={props.article} />
      <CommentsButton article={props.article} />
      <ToggleReadButton
        article={props.article}
        className="cursor-pointer justify-start text-sm"
      />
      {!props.hideSummarizeButton && (
        <AiSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          size="sm"
          className="justify-start text-sm"
        />
      )}
      <VisitButton
        article={props.article}
        size="sm"
        className="justify-start text-sm"
      />
    </div>
  </>
);

export default ArticleCardActions;
