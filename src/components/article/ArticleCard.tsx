"use client";

import AiLeadStream from "@/components/article/AiLeadStream";
import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import { ReadingTimeBadge } from "@/components/article/ReadingTimeBadge";
import { WordCountBadge } from "@/components/article/WordCountBadge";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Typography from "@/components/ui/typography";
import {
  markArticleAsRead,
  unmarkArticleAsRead,
} from "@/lib/repository/articleRepository";
import { cn } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
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
        props.article.readAt !== null ? "opacity-65" : "",
        props.className,
      )}
      onClick={props.onClick}
      ref={cardRef}
    >
      <CardHeader>
        <CardTitle className="flex flex-col gap-4">
          <Link href={props.article.link} referrerPolicy="no-referrer">
            {props.article.title}
          </Link>
        </CardTitle>

        <div className="flex flex-row gap-2 align-middle text-sm text-muted-foreground">
          <div>
            <Link href={`/feed/${props.article.feedId}`}>
              {props.article.feed.title}
            </Link>
            , <IntlRelativeTime date={props.article.publicationDate} />
          </div>
          {articleReadingTime && (
            <>
              <ReadingTimeBadge minutes={articleReadingTime.minutes} />
              <WordCountBadge words={articleReadingTime.words} />
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Typography className="text-pretty text-justify text-sm" variant="p">
          <AiLeadStream articleId={props.article.id} />
        </Typography>
      </CardContent>

      <CardFooter>
        <ArticleCardActions article={props.article} />
      </CardFooter>
    </Card>
  );
};

export default ArticleCard;
