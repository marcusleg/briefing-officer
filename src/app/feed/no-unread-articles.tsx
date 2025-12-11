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
import { BookmarkIcon, CheckCircle } from "lucide-react";
import Link from "next/link";

const NoUnreadArticles = async () => {
  const userId = await getUserId();
  const readLaterCount = await prisma.article.count({
    where: { userId, readLater: true },
  });

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CheckCircle />
        </EmptyMedia>
        <EmptyTitle>All caught up!</EmptyTitle>
        <EmptyDescription>
          You&apos;ve read all your unread articles. Great job staying informed!
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {readLaterCount > 0 && (
          <>
            <span className="block">
              You have {readLaterCount} article
              {readLaterCount !== 1 ? "s" : ""} saved for later.
            </span>

            <Button asChild variant="outline">
              <Link href="/feed/read-later">
                <BookmarkIcon />
                Go to Read Later
              </Link>
            </Button>
          </>
        )}

        <p className="text-muted-foreground text-xs">
          New articles will appear here as your feeds update
        </p>
      </EmptyContent>
    </Empty>
  );
};

export default NoUnreadArticles;
