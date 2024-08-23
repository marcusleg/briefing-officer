import {
  markArticleAsRead,
  markArticleAsUnread,
} from "@/app/feed/[feedId]/actions";
import AiLeadButton from "@/components/article/AiLeadButton";
import ToggleReadButton from "@/components/article/ToggleReadButton";
import IntlDateTime from "@/components/IntlDateTime";
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
import { BookText, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ArticleCardProps {
  article: Prisma.ArticleGetPayload<{ include: { aiSummary: true } }>;
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

    if (props.article.read) {
      await markArticleAsUnread(props.article.id);
    } else {
      await markArticleAsRead(props.article.id);
    }
  });

  return (
    <Card
      className={cn(
        "max-w-4xl",
        props.article.read ? "opacity-50" : "",
        props.className,
      )}
      onClick={props.onClick}
      ref={cardRef}
    >
      <CardHeader>
        <CardTitle>
          <Link href={props.article.link} referrerPolicy="no-referrer">
            {props.article.title}
          </Link>
        </CardTitle>
        <CardDescription>
          <IntlDateTime date={props.article.publicationDate} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Typography className="text-pretty text-justify text-sm" variant="p">
          {props.article.aiSummary?.lead
            ? props.article.aiSummary.lead
            : props.article.description}
        </Typography>
      </CardContent>
      <CardFooter className="flex flex-row gap-2">
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={props.article.link}
          referrerPolicy="no-referrer"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Visit
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/feed/${props.article.feedId}/${props.article.id}/reader-view`}
        >
          <BookText className="mr-2 h-4 w-4" />
          Reader View
        </Link>
        <ToggleReadButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          isRead={props.article.read}
        />
        {!props.article.aiSummary?.lead && (
          <AiLeadButton articleId={props.article.id} />
        )}
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/feed/${props.article.feedId}/${props.article.id}/ai-summary`}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          AI Summary
        </Link>
      </CardFooter>
    </Card>
  );
};

export default ArticleCard;
