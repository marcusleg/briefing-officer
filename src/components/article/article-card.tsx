"use client";

import { ArticleCardActions } from "@/components/article/article-card-actions";
import ArticleMeta from "@/components/article/article-meta";
import ArticleReadingTime from "@/components/article/article-reading-time";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { generateAiLead } from "@/lib/ai";
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
    const className = "text-justify text-sm leading-relaxed";

    if (!props.article.scrape?.textContent) {
      return (
        <p className={className}>
          No content available. Visit the original article.
        </p>
      );
    }

    if (!aiLead) {
      return (
        <LoaderCircleIcon className="mx-auto my-12 h-8 w-8 animate-spin" />
      );
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
    <Card className={className} onClick={props.onClick}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="hover:text-primary mb-3 text-xl leading-tight font-semibold transition-colors">
              {props.article.title}
            </h2>

            <ArticleMeta
              feedTitle={props.article.feed.title}
              author={props.article.scrape?.author}
              date={props.article.publicationDate}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>{description()}</CardContent>

      <CardFooter>
        {articleReadingTime && (
          <ArticleReadingTime
            text={articleReadingTime.text}
            words={articleReadingTime.words}
          />
        )}

        <div className="grow" />

        <ArticleCardActions article={props.article} />
      </CardFooter>
    </Card>
  );
};

export default ArticleCard;
