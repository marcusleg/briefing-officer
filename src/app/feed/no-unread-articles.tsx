import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { BookOpen, CheckCircle } from "lucide-react";
import Link from "next/link";

const NoUnreadArticles = async () => {
  const userId = await getUserId();
  const readLaterCount = await prisma.article.count({
    where: { userId, readLater: true },
  });

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <h2 className="mb-2 text-xl font-semibold">All caught up!</h2>

          <p className="mb-6 leading-relaxed text-muted-foreground">
            You've read all your unread articles. Great job staying informed!
            {readLaterCount > 0 && (
              <span className="mt-2 block">
                You have {readLaterCount} article
                {readLaterCount !== 1 ? "s" : ""} saved for later.
              </span>
            )}
          </p>

          {readLaterCount > 0 && (
            <Button asChild className="w-full">
              <Link href="/feed/read-later">
                <BookOpen className="mr-2 h-4 w-4" />
                Continue to your Read Later page
              </Link>
            </Button>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            New articles will appear here as your feeds update
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoUnreadArticles;
