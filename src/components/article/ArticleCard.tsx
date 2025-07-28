"use client";

import AiLeadStream from "@/components/article/AiLeadStream";
import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  UserIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useInView } from "react-intersection-observer";
import readingTime from "reading-time";

interface ArticleCardProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

const ArticleCard = (props: ArticleCardProps) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
  });

  useEffect(() => {
    if (!props.selected || !cardRef.current) {
      return;
    }

    cardRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [props.selected]);

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
        "cursor-pointer transition-shadow duration-200 hover:shadow-lg",
        props.article.readAt !== null ? "opacity-65" : "",
        props.className,
      )}
      onClick={props.onClick}
      ref={cardRef}
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

      <CardContent className="px-4 md:pb-6" ref={inViewRef}>
        {/* Article Summary */}
        <p className="mb-4 text-justify leading-relaxed">
          {inView && <AiLeadStream articleId={props.article.id} />}
        </p>

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
