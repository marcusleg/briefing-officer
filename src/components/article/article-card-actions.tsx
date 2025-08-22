"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
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

export const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <div className="flex flex-wrap items-center gap-2">
    {props.showBackButton && (
      <>
        <BackButton />

        <Separator className="mx-1 h-auto py-4" orientation="vertical" />
      </>
    )}

    <ToggleReadButton article={props.article} />

    <VisitButton article={props.article} size="sm" />

    {!props.hideAiSummary && (
      <AiSummaryButton
        feedId={props.article.feedId}
        articleId={props.article.id}
        size="sm"
      />
    )}

    <ToggleReadLaterButton article={props.article} />

    <ToggleStarredButton article={props.article} />
  </div>
);
