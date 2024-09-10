import ArticleList from "@/components/article/ArticleList";
import NumberOfArticlesReadLast7DaysChart from "@/components/frontpage/NumberOfArticlesReadLast7DaysChart";
import NumberOfNewArticlesLast7DaysChart from "@/components/frontpage/NumberOfNewArticlesLast7DaysChart";
import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import {
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";

const Home = async () => {
  const articles = await prisma.article.findMany({
    include: {
      aiTexts: true,
      feed: true,
      scrape: true,
    },
    where: {
      readAt: null,
    },
    orderBy: {
      publicationDate: "desc",
    },
  });

  const unreadArticlesChartData = await getUnreadArticlesPerFeed();
  const numberOfNewArticlesLast7DaysChartData =
    await getWeeklyArticleCountPerFeed();
  const numberOfArticlesReadLast7DaysChartData = await getWeeklyArticlesRead();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <UnreadArticlesChart chartData={unreadArticlesChartData} />
        <NumberOfNewArticlesLast7DaysChart
          chartData={numberOfNewArticlesLast7DaysChartData}
        />
        <NumberOfArticlesReadLast7DaysChart
          chartData={numberOfArticlesReadLast7DaysChartData}
        />
      </div>

      <Typography variant="h2">Unread articles from your feeds</Typography>

      <ArticleList articles={articles} />
    </div>
  );
};

export default Home;
