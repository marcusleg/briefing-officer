import Dashboard from "@/app/feed/dashboard";
import NoFeedsMessage from "@/app/feed/no-feeds-message";
import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/navigation/TopNavigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const MyFeeds = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const feedCount = await prisma.feed.count({
    where: { userId: session.user.id },
  });
  if (feedCount === 0) {
    return <NoFeedsMessage />;
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      scrape: true,
      user: true,
    },
    where: {
      readAt: null,
      readLater: false,
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "desc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation page="All Feeds" />

      <Dashboard />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          Unread articles from your feeds
        </h2>
        <Badge variant="secondary" className="text-sm">
          {articles.length} articles
        </Badge>
      </div>

      <Separator />

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <Typography
          variant="p"
          className="my-8 text-center text-lg text-muted-foreground"
        >
          There are no unread articles.
        </Typography>
      )}
    </div>
  );
};

export default MyFeeds;
