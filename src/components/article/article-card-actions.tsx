"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
import CommentsButton from "@/components/article/comments-button";
import ToggleReadButton from "@/components/article/toggle-read-button";
import ToggleReadLaterButton from "@/components/article/toggle-read-later-button";
import ToggleStarredButton from "@/components/article/toggle-starred-button";
import VisitButton from "@/components/article/visit-button";
import BackButton from "@/components/navigation/back-button";
import { Separator } from "@/components/ui/separator";
import { Prisma } from "@prisma/client";

interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  hideAiSummary?: boolean;
  showBackButton?: boolean;
}

const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <div className="flex flex-wrap gap-2">
    {props.showBackButton && (
      <>
        <BackButton />

        <Separator className="mx-1 h-auto py-4" orientation="vertical" />
      </>
    )}

    <ToggleReadLaterButton article={props.article} />

    <ToggleStarredButton article={props.article} />

    <CommentsButton article={props.article} />

    <ToggleReadButton
      article={props.article}
      className="cursor-pointer justify-start text-sm"
    />

    {!props.hideAiSummary && (
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
);

export default ArticleCardActions;
