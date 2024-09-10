import ArticleList from "@/components/article/ArticleList";
import NumberOfArticlesLast7DaysChart from "@/components/frontpage/NumberOfArticlesLast7DaysChart";
import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import {
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
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
  const numberOfArticlesLast7DaysChartData =
    await getWeeklyArticleCountPerFeed();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <UnreadArticlesChart chartData={unreadArticlesChartData} />
        <NumberOfArticlesLast7DaysChart
          chartData={numberOfArticlesLast7DaysChartData}
        />
      </div>

      <Typography variant="h2">Unread articles from your feeds</Typography>

      <ArticleList articles={articles} />
    </div>
  );
};

export default Home;
