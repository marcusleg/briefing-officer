import UnreadArticlesInTotal from "@/components/frontpage/UnreadArticlesInTotal";
import UnreadArticlesPerFeedChart from "@/components/frontpage/UnreadArticlesPerFeedChart";
import prisma from "@/lib/prismaClient";

const Home = async () => {
  const feedWithUnreadArticleCount = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { read: false } },
        },
      },
    },
  });
  const chartData = feedWithUnreadArticleCount.map((feed) => {
    return {
      feedTitle: feed.title,
      unread: feed._count.articles,
    };
  });

  const unreadArticlesInTotal = feedWithUnreadArticleCount.reduce(
    (acc, feed) => acc + feed._count.articles,
    0,
  );

  return (
    <main className="flex gap-4">
      <UnreadArticlesInTotal unreadArticles={unreadArticlesInTotal} />
      <UnreadArticlesPerFeedChart chartData={chartData} />
    </main>
  );
};

export default Home;
