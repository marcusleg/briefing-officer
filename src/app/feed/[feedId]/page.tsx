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
import { Button, buttonVariants } from "@/components/ui/button";
import { BookText, ExternalLink, Sparkles, SquareCheck } from "lucide-react";
import { markArticleAsRead } from "@/app/feed/[feedId]/actions";
import ToggleReadButton from "@/components/ToggleReadButton";

const Feed = async ({ params }: { params: { feedId: string } }) => {
  const feedId = parseInt(params.feedId);

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });
  const articles = await prisma.article.findMany({
    where: { feedId: feedId },
  });

  return (
    <div className="m-2">
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        {feed.title}
      </h2>
      <div className="flex flex-row gap-4 items-center my-4">
        <RefreshFeedButton feedId={feedId} />
        Last updated: {feed.lastFetched.toLocaleString()}
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
              <Button variant="outline">
                <BookText className="mr-2 h-4 w-4" />
                Reader Mode
              </Button>
              <ToggleReadButton
                feedId={feedId}
                articleId={article.id}
                isRead={article.read}
              />
              <Button variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Summary
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Feed;
