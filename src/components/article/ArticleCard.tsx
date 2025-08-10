"use client";

import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { generateAiLead } from "@/lib/ai";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { cn } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import {
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  GlobeIcon,
  LoaderCircleIcon,
  UserIcon,
} from "lucide-react";
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
  const [aiLead, setAiLead] = useState(props.article.lead?.text);

  useEffect(() => {
    if (!props.article.lead) {
      generateAiLead(props.article.id).then((lead) => setAiLead(lead));
    }
  });

  useHotkeys("v", async () => {
    if (!props.selected) {
      return;
    }

    window.open(props.article.link, "_blank");
    await markArticleAsRead(props.article.id);
  });

  useHotkeys("m", async () => {
    if (!props.selected) {
      return;
    }

    if (props.article.readAt !== null) {
      await unmarkArticleAsRead(props.article.id);
    } else {
      await markArticleAsRead(props.article.id);
    }
  });

  const articleReadingTime = props.article.scrape
    ? readingTime(props.article.scrape.textContent)
    : undefined;

  return (
    <Card
      className={cn(
        "transition-shadow duration-200 hover:shadow-lg",
        props.article.readAt !== null ? "opacity-65" : "",
        props.className,
      )}
      onClick={props.onClick}
    >
      <CardHeader className="px-4 pb-3 md:pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="mb-3 text-xl font-semibold leading-tight transition-colors hover:text-primary">
              {props.article.title}
            </h2>

            {/* Source, Author and Time */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1 font-medium">
                <GlobeIcon className="h-4 w-4" />
                <span>{props.article.feed.title}</span>
              </div>
              {props.article.scrape?.author && (
                <div className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4" />
                  <span>{props.article.scrape?.author}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  <IntlRelativeTime date={props.article.publicationDate} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 md:pb-6">
        {/* Article Summary */}
        {aiLead ? (
          <p className="mb-4 text-justify text-sm leading-relaxed">{aiLead}</p>
        ) : (
          <LoaderCircleIcon className="mx-auto my-12 h-8 w-8 animate-spin" />
        )}

        {/* Metadata Badges */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {articleReadingTime && (
            <>
              <Badge variant="outline" className="text-xs">
                <ClockIcon className="mr-1 h-3 w-3" />
                {articleReadingTime.text}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <FileTextIcon className="mr-1 h-3 w-3" />
                {articleReadingTime.words} words
              </Badge>
            </>
          )}
        </div>

        <Separator />

        <ArticleCardActions article={props.article} />
      </CardContent>
    </Card>
  );
};

export default ArticleCard;
