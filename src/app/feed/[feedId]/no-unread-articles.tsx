import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { CheckCircle, NewspaperIcon } from "lucide-react";
import Link from "next/link";
import { Feed } from "../../../../prisma/generated/prisma/client";

interface NoUnreadArticlesProps {
  feed: Feed;
}

const NoUnreadArticles = async ({ feed }: NoUnreadArticlesProps) => {
  const userId = await getUserId();
  const globalUnreadCount = await prisma.article.count({
    where: { userId, readAt: null },
  });

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CheckCircle />
        </EmptyMedia>
        <EmptyTitle>All caught up!</EmptyTitle>
        <EmptyDescription>
          You&apos;ve read all {feed.title} articles. Great job staying
          informed!
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {globalUnreadCount > 0 && (
          <>
            <span className="block">
              You have {globalUnreadCount} unread article
              {globalUnreadCount !== 1 ? "s" : ""} in your other feeds.
            </span>
            <Button asChild variant="outline">
              <Link href="/feed">
                <NewspaperIcon />
                Go to All Feeds
              </Link>
            </Button>
          </>
        )}

        <p className="text-muted-foreground text-xs">
          New articles will appear here as this feed updates
        </p>
      </EmptyContent>
    </Empty>
  );
};

export default NoUnreadArticles;
