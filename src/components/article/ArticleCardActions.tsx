"use client";

import AdditionArticleActionsButton from "@/components/article/AdditionArticleActionsButton";
import AiLeadButton from "@/components/article/AiLeadButton";
import AiSummaryButton from "@/components/article/AiSummaryButton";
import ToggleReadButton from "@/components/article/ToggleReadButton";
import ToggleReadLaterButton from "@/components/article/ToggleReadLaterButton";
import ToggleStarredButton from "@/components/article/ToggleStarredButton";
import VisitButton from "@/components/article/VisitButton";
import BackButton from "@/components/layout/BackButton";
import { Separator } from "@/components/ui/separator";
import { Prisma } from "@prisma/client";

interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { aiTexts: true; feed: true; scrape: true };
  }>;
  hideAiSummary?: boolean;
  showBackButton?: boolean;
}

export const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <div className="flex flex-row flex-wrap gap-2">
    {props.showBackButton && (
      <>
        <BackButton />

        <Separator className="mx-1 h-auto py-4" orientation="vertical" />
      </>
    )}

    <ToggleReadButton article={props.article} />

    <Separator className="mx-1 h-auto py-4" orientation="vertical" />

    <VisitButton article={props.article} size="sm" />

    {!props.article.aiTexts?.lead && (
      <AiLeadButton articleId={props.article.id} />
    )}

    {!props.hideAiSummary && (
      <AiSummaryButton
        feedId={props.article.feedId}
        articleId={props.article.id}
        size="sm"
      />
    )}

    <Separator className="mx-1 h-auto py-4" orientation="vertical" />

    <ToggleReadLaterButton article={props.article} />

    <ToggleStarredButton article={props.article} />

    <Separator className="mx-1 h-auto py-4" orientation="vertical" />

    <AdditionArticleActionsButton article={props.article} />
  </div>
);
