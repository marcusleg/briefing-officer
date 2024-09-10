import AdditionArticleActionsButton from "@/components/article/AdditionArticleActionsButton";
import AiLeadButton from "@/components/article/AiLeadButton";
import AiSummaryButton from "@/components/article/AiSummaryButton";
import ReadAloudButton from "@/components/article/ReadAloudButton";
import ToggleReadButton from "@/components/article/ToggleReadButton";
import ToggleReadLaterButton from "@/components/article/ToggleReadLaterButton";
import ToggleStarredButton from "@/components/article/ToggleStarredButton";
import VisitButton from "@/components/article/VisitButton";
import { Separator } from "@/components/ui/separator";
import { Prisma } from "@prisma/client";

export const ArticleCardActions = (props: {
  article: Prisma.ArticleGetPayload<{
    include: { aiTexts: true; feed: true; scrape: true };
  }>;
}) => (
  <div className="flex flex-row flex-wrap gap-2">
    <ToggleReadButton article={props.article} />

    <Separator className="mx-1 h-auto py-4" orientation="vertical" />

    <VisitButton article={props.article} size="sm" />

    {!props.article.aiTexts?.lead && (
      <AiLeadButton articleId={props.article.id} />
    )}

    <AiSummaryButton
      feedId={props.article.feedId}
      articleId={props.article.id}
      size="sm"
    />

    <ReadAloudButton article={props.article} />

    <Separator className="mx-1 h-auto py-4" orientation="vertical" />

    <ToggleReadLaterButton article={props.article} />

    <ToggleStarredButton article={props.article} />

    <Separator className="mx-1 h-auto py-4" orientation="vertical" />

    <AdditionArticleActionsButton article={props.article} />
  </div>
);
