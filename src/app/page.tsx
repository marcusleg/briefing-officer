import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
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

  return (
    <main className="flex gap-4">
      <UnreadArticlesChart chartData={chartData} />
    </main>
  );
};

export default Home;
