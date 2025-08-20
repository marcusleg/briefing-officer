import Dashboard from "@/app/feed/dashboard";
import FeedTitle from "@/app/feed/feed-title";
import NoFeedsMessage from "@/app/feed/no-feeds-message";
import NoUnreadArticles from "@/app/feed/no-unread-articles";
import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/navigation/TopNavigation";
import { Separator } from "@/components/ui/separator";
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

  const { lastFetched } = await prisma.feed.findFirstOrThrow({
    select: { lastFetched: true },
    where: { userId: session.user.id },
    orderBy: { lastFetched: "desc" },
  });

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
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

      <div>
        <FeedTitle
          title="Unread articles from your feeds"
          articleCount={articles.length}
          lastUpdated={lastFetched}
        />
      </div>

      <Separator />

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <NoUnreadArticles />
      )}
    </div>
  );
};

export default MyFeeds;
