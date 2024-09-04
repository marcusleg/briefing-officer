"use client";

import {
  markArticleAsRead,
  markArticleAsUnread,
} from "@/app/feed/[feedId]/actions";
import AiLeadButton from "@/components/article/AiLeadButton";
import AiSummaryButton from "@/components/article/AiSummaryButton";
import ToggleReadButton from "@/components/article/ToggleReadButton";
import VisitButton from "@/components/article/VisitButton";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Typography from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import { BookText, Clock, LetterText } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import readingTime from "reading-time";

interface ArticleCardProps {
  article: Prisma.ArticleGetPayload<{
    include: { aiTexts: true; feed: true; readability: true };
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
      await markArticleAsUnread(props.article.id);
    } else {
      await markArticleAsRead(props.article.id);
    }
  });

  const articleReadingTime = props.article.readability
    ? readingTime(props.article.readability.textContent)
    : undefined;

  return (
    <Card
      className={cn(
        props.article.readAt !== null ? "opacity-50" : "",
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
        <CardDescription className="flex flex-row gap-2 align-middle text-sm">
          <div>
            <Link href={`/feed/${props.article.feedId}`}>
              {props.article.feed.title}
            </Link>
            , <IntlRelativeTime date={props.article.publicationDate} />
          </div>
          {articleReadingTime && (
            <>
              <Badge className="text-muted-foreground" variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                {articleReadingTime.text}
              </Badge>
              <Badge className="text-muted-foreground" variant="outline">
                <LetterText className="mr-2 h-4 w-4" />
                {articleReadingTime.words} words
              </Badge>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Typography className="text-pretty text-justify text-sm" variant="p">
          {props.article.aiTexts?.lead
            ? props.article.aiTexts.lead
            : props.article.description}
        </Typography>
      </CardContent>
      <CardFooter className="flex flex-row flex-wrap gap-2">
        <VisitButton article={props.article} size="sm" />
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={`/feed/${props.article.feedId}/${props.article.id}/reader-view`}
        >
          <BookText className="mr-2 h-4 w-4" />
          Reader View
        </Link>
        {!props.article.aiTexts?.lead && (
          <AiLeadButton articleId={props.article.id} />
        )}
        <AiSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          size="sm"
        />
        <ToggleReadButton article={props.article} />
      </CardFooter>
    </Card>
  );
};

export default ArticleCard;
