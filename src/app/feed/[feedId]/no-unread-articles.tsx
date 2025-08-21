import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { Feed } from "@prisma/client";
import { CheckCircle, NewspaperIcon } from "lucide-react";
import Link from "next/link";

interface NoUnreadArticlesProps {
  feed: Feed;
}

const NoUnreadArticles = async ({ feed }: NoUnreadArticlesProps) => {
  const userId = await getUserId();
  const globalUnreadCount = await prisma.article.count({
    where: { userId, readAt: null },
  });

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <h2 className="mb-2 text-xl font-semibold">All caught up!</h2>

          <p className="text-muted-foreground mb-6 leading-relaxed">
            You&apos;ve read all {feed.title} articles. Great job staying
            informed!
            {globalUnreadCount > 0 && (
              <span className="mt-2 block">
                You have {globalUnreadCount} unread article
                {globalUnreadCount !== 1 ? "s" : ""} in your other feeds.
              </span>
            )}
          </p>

          {globalUnreadCount > 0 && (
            <Button asChild className="w-full">
              <Link href="/feed">
                <NewspaperIcon className="mr-2 h-4 w-4" />
                Go to All Feeds
              </Link>
            </Button>
          )}

          <p className="text-muted-foreground mt-4 text-xs">
            New articles will appear here as this feed updates
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoUnreadArticles;
