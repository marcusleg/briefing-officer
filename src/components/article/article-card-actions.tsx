"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
import AudioSummaryButton from "@/components/article/audio-summary-button";
import CommentsButton from "@/components/article/comments-button";
import DismissButton from "@/components/article/dismiss-button";
import ToggleReadLaterButton from "@/components/article/toggle-read-later-button";
import ToggleStarredButton from "@/components/article/toggle-starred-button";
import VisitButton from "@/components/article/visit-button";
import { Prisma } from "@/generated/prisma/client";
import { ClockIcon } from "lucide-react";
import readingTime from "reading-time";

type Article = Prisma.ArticleGetPayload<{
  include: { feed: true; scrape: true };
}>;

type ReadingTime = ReturnType<typeof readingTime>;

interface ArticleCardActionsProps {
  article: Article;
  /** The page rendering this row, so it can suppress its own entry. */
  currentPage?: "text-summary" | "audio-summary";
  onAfterDismiss?: () => void;
}

const ReadingTimeLabel = ({ readingTime }: { readingTime: ReadingTime }) => (
  <span className="text-muted-foreground flex items-center gap-1 text-xs">
    <ClockIcon className="size-3" />
    {readingTime.text}
  </span>
);

const IconActions = ({
  article,
  currentPage,
  variant,
}: {
  article: Article;
  currentPage?: ArticleCardActionsProps["currentPage"];
  variant?: "ghost";
}) => (
  <>
    <ToggleReadLaterButton article={article} variant={variant} />
    <ToggleStarredButton article={article} variant={variant} />
    <CommentsButton article={article} variant={variant} />
    {currentPage !== "audio-summary" && (
      <AudioSummaryButton
        feedId={article.feedId}
        articleId={article.id}
        variant={variant}
      />
    )}
  </>
);

const LabelledActions = ({
  article,
  className,
  currentPage,
  onAfterDismiss,
}: {
  article: Article;
  className: string;
  currentPage?: ArticleCardActionsProps["currentPage"];
  onAfterDismiss?: () => void;
}) => (
  <>
    <DismissButton
      article={article}
      className={className}
      onAfterDismiss={onAfterDismiss}
    />
    {currentPage !== "text-summary" && (
      <AiSummaryButton
        feedId={article.feedId}
        articleId={article.id}
        className={className}
      />
    )}
    <VisitButton article={article} className={className} />
  </>
);

const ArticleCardActions = (props: ArticleCardActionsProps) => {
  const articleReadingTime = props.article.scrape
    ? readingTime(props.article.scrape.textContent)
    : undefined;

  return (
    <>
      {/* Mobile: row 1 — reading time left, icon buttons right */}
      <div className="flex w-full items-center gap-2 md:hidden">
        {articleReadingTime && (
          <ReadingTimeLabel readingTime={articleReadingTime} />
        )}
        <div className="grow" />
        <IconActions
          article={props.article}
          currentPage={props.currentPage}
          variant="ghost"
        />
      </div>

      {/* Mobile: row 2 — full-width labeled buttons */}
      <div className="flex w-full gap-2 md:hidden">
        <LabelledActions
          article={props.article}
          className="flex-1 cursor-pointer justify-center text-sm"
          currentPage={props.currentPage}
          onAfterDismiss={props.onAfterDismiss}
        />
      </div>

      {/* Desktop: single row */}
      <div className="hidden md:flex md:w-full md:items-center md:gap-2">
        {articleReadingTime && (
          <ReadingTimeLabel readingTime={articleReadingTime} />
        )}
        <div className="grow" />
        <IconActions article={props.article} currentPage={props.currentPage} />
        <LabelledActions
          article={props.article}
          className="cursor-pointer justify-start text-sm"
          currentPage={props.currentPage}
          onAfterDismiss={props.onAfterDismiss}
        />
      </div>
    </>
  );
};

export default ArticleCardActions;
