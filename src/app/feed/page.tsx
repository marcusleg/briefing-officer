import Dashboard from "@/app/feed/dashboard";
import FeedTitle from "@/app/feed/feed-title";
import NoFeedsMessage from "@/app/feed/no-feeds-message";
import NoUnreadArticles from "@/app/feed/no-unread-articles";
import RefreshAllFeedsButton from "@/app/feed/refresh-all-feeds-button";
import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import { auth } from "@/lib/auth";
import { getInboxArticles } from "@/lib/inbox";
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

  const articles = await getInboxArticles(session.user.id);
  // The count measures triage progress, so it leaves out articles already
  // saved for later; the sidebar badge counts those.
  const unreadCount = articles.filter(
    (article) => article.status === "UNREAD",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation page="Feeds" />

      <Dashboard />

      <div className="flex flex-col items-center gap-2 xl:flex-row">
        <FeedTitle
          title="Your Latest Reads"
          articleCount={unreadCount}
          lastUpdated={lastFetched}
        />

        <div className="grow" />

        <div>
          <RefreshAllFeedsButton />
        </div>
      </div>

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <NoUnreadArticles />
      )}
    </div>
  );
};

export default MyFeeds;
