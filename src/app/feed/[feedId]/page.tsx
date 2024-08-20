import prisma from "@/lib/prismaClient";
import RefreshFeedButton from "@/components/RefreshFeedButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BookText, ExternalLink, Filter, Sparkles } from "lucide-react";
import ToggleReadButton from "@/components/ToggleReadButton";
import FeedFilterButton from "@/components/FeedFilterButton";

const Feed = async ({
  params,
  searchParams,
}: {
  params: { feedId: string };
  searchParams: { show: "all" | "unread" };
}) => {
  const feedId = parseInt(params.feedId);
  const showSearchParam = searchParams["show"] || "unread";

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });
  const articles = await prisma.article.findMany({
    where: {
      feedId: feedId,
      read: showSearchParam === "all" ? undefined : false,
    },
    orderBy: { publicationDate: "desc" },
  });

  return (
    <div className="m-2">
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        {feed.title}
      </h2>
      <div className="flex flex-row gap-4 items-center my-4">
        <FeedFilterButton />
        <RefreshFeedButton feedId={feedId} />
        <p className="text-sm text-muted-foreground">
          Last updated: {feed.lastFetched.toLocaleString()}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {articles.map((article) => (
          <Card key={article.id} className={article.read ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle>
                <Link href={article.link}>{article.title}</Link>
              </CardTitle>
              <CardDescription>
                {article.publicationDate.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>{article.description}</CardContent>
            <CardFooter className="flex flex-row gap-2">
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={article.link}
                referrerPolicy="no-referrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/feed/${feedId}/${article.id}/reader-view`}
              >
                <BookText className="mr-2 h-4 w-4" />
                Reader View
              </Link>
              <ToggleReadButton
                feedId={feedId}
                articleId={article.id}
                isRead={article.read}
              />
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/feed/${feedId}/${article.id}/ai-summary`}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Summary
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Feed;
