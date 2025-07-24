import ArticleList from "@/components/article/ArticleList";
import NumberOfArticlesReadLast7DaysChart from "@/components/frontpage/NumberOfArticlesReadLast7DaysChart";
import NumberOfNewArticlesLast7DaysChart from "@/components/frontpage/NumberOfNewArticlesLast7DaysChart";
import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import {
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import { headers } from "next/headers";

const Home = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      scrape: true,
      user: true,
    },
    where: {
      readAt: null,
      userId: session.user.id,
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
      <div className="hidden grid-cols-3 gap-4 lg:visible lg:grid">
        <UnreadArticlesChart chartData={unreadArticlesChartData} />
        <NumberOfNewArticlesLast7DaysChart
          chartData={numberOfNewArticlesLast7DaysChartData}
        />
        <NumberOfArticlesReadLast7DaysChart
          chartData={numberOfArticlesReadLast7DaysChartData}
        />
      </div>

      <Typography variant="h2">Unread articles from your feeds</Typography>

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

export default Home;
