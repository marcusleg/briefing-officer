import AiLeadButton from "@/components/article/AiLeadButton";
import ToggleReadButton from "@/components/article/ToggleReadButton";
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

const ArticleCard = (props: {
  article: Prisma.ArticleGetPayload<{ include: { aiSummary: true } }>;
}) => (
  <Card className={cn("max-w-4xl", props.article.read ? "opacity-50" : "")}>
    <CardHeader>
      <CardTitle>
        <Link href={props.article.link} referrerPolicy="no-referrer">
          {props.article.title}
        </Link>
      </CardTitle>
      <CardDescription>
        {props.article.publicationDate.toLocaleString()}
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
        <AiLeadButton
          feedId={props.article.feedId}
          articleId={props.article.id}
        />
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

export default ArticleCard;
