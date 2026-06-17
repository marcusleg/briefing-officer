"use client";

import ArticleCardActions from "@/components/article/article-card-actions";
import ArticleMeta from "@/components/article/article-meta";
import IntlRelativeTime from "@/components/intl-relative-time";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { generateAiLead } from "@/lib/ai/services/leadService";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { Prisma } from "@prisma/client";
import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import readingTime from "reading-time";

interface ArticleCardProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; lead: true; scrape: true };
  }>;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

const ArticleCard = (props: ArticleCardProps) => {
  const router = useRouter();
  const [aiLead, setAiLead] = useState(props.article.lead?.text);

  useEffect(() => {
    if (!props.article.lead && props.article.scrape?.textContent) {
      generateAiLead(props.article.id).then((lead) => setAiLead(lead));
    }
  }, [props.article]);

  const createHotkeyHandler = (handler: () => Promise<void> | void) => () => {
    if (props.selected) {
      handler();
    }
  };

  useHotkeys(
    "s",
    createHotkeyHandler(() => {
      router.push(
        `/feed/${props.article.feed}/article/${props.article.id}/ai-summary`,
      );
    }),
  );

  useHotkeys(
    "v",
    createHotkeyHandler(async () => {
      window.open(props.article.link, "_blank");
      await markArticleAsRead(props.article.id);
    }),
  );

  useHotkeys(
    "m",
    createHotkeyHandler(async () => {
      if (props.article.readAt !== null) {
        await unmarkArticleAsRead(props.article.id);
      } else {
        await markArticleAsRead(props.article.id);
      }
    }),
  );

  const articleReadingTime = props.article.scrape
    ? readingTime(props.article.scrape.textContent)
    : undefined;

  const description = () => {
    const className = "text-base leading-relaxed";

    if (!props.article.scrape?.textContent) {
      return (
        <p className={className}>
          No content available. Visit the original article.
        </p>
      );
    }

    if (!aiLead) {
      return <LoaderCircleIcon className="mx-auto my-12 size-8 animate-spin" />;
    }

    return <p className={className}>{aiLead}</p>;
  };

  let className = "transition-all duration-200 hover:scale-101 hover:shadow-lg";
  if (props.selected) {
    className +=
      " border-foreground scale-101 border shadow-lg transition-all duration-200";
  }
  if (props.article.readAt !== null) {
    className += " opacity-65";
  }

  return (
    <Card
      className={`${className} gap-4 py-4 md:gap-6 md:py-6`}
      onClick={props.onClick}
    >
      <CardHeader className="px-4 md:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-4 flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground font-semibold tracking-wide uppercase">
                {props.article.feed.title}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                <IntlRelativeTime date={props.article.publicationDate} />
              </span>
            </div>

            <h2 className="hover:text-primary mb-3 text-2xl leading-tight font-semibold wrap-break-word transition-colors">
              {props.article.title}
            </h2>

            <ArticleMeta author={props.article.scrape?.author} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 md:px-6">{description()}</CardContent>

      <CardFooter className="flex-col gap-3 border-t px-4 md:flex md:flex-row md:items-center md:gap-2 md:px-6">
        <ArticleCardActions
          article={props.article}
          readingTime={articleReadingTime}
        />
      </CardFooter>
    </Card>
  );
};

export default ArticleCard;
