import ArticleList from "@/components/article/ArticleList";
import NumberOfArticlesLast7DaysChart from "@/components/frontpage/NumberOfArticlesLast7DaysChart";
import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";

const getLast7Days = () => {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const from = new Date(today);
    from.setDate(today.getDate() - 6 + i - 1);
    const fromFormatted = from.toISOString().split("T")[0];

    const to = new Date(today);
    to.setDate(today.getDate() - 6 + i);
    const toFormatted = to.toISOString().split("T")[0];

    dates.push({ from: fromFormatted, to: toFormatted });
  }

  return dates;
};

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

  const feedWithUnreadArticleCount = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { readAt: null } },
        },
      },
    },
  });
  const unreadArticlesChartData = feedWithUnreadArticleCount.map((feed) => {
    return {
      feedTitle: feed.title,
      unread: feed._count.articles,
    };
  });

  const last7Days = getLast7Days();
  const numberOfArticlesLast7Days = await Promise.all(
    last7Days.map((dateRange) =>
      prisma.article.aggregate({
        _count: {
          _all: true,
        },
        where: {
          publicationDate: {
            gte: new Date(dateRange.from),
            lt: new Date(dateRange.to),
          },
        },
      }),
    ),
  );
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const numberOfArticlesLast7DaysChartData = last7Days.map(
    (dateRange, index) => ({
      weekday: weekDays[new Date(dateRange.to).getDay()],
      count: numberOfArticlesLast7Days[index]._count._all,
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <UnreadArticlesChart chartData={unreadArticlesChartData} />
        <NumberOfArticlesLast7DaysChart
          chartData={numberOfArticlesLast7DaysChartData}
          from={last7Days[0].from}
          to={last7Days[6].to}
        />
      </div>

      <Typography variant="h2">Unread articles from your feeds</Typography>

      <ArticleList articles={articles} />
    </div>
  );
};

export default Home;
