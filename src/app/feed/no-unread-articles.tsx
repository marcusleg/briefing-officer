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
import { CheckCircle } from "lucide-react";

const NoUnreadArticles = async () => {
  const userId = await getUserId();
  const readLaterCount = await prisma.article.count({
    where: { userId, status: "READ_LATER" },
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
          <span className="block">
            {readLaterCount === 1
              ? "The article you saved for later is waiting below."
              : `The ${readLaterCount} articles you saved for later are waiting below.`}
          </span>
        )}

        <p className="text-muted-foreground text-xs">
          New articles will appear here as your feeds update
        </p>
      </EmptyContent>
    </Empty>
  );
};

export default NoUnreadArticles;
