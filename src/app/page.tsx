import NumberOfArticlesLast7DaysChart from "@/components/frontpage/NumberOfArticlesLast7DaysChart";
import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import prisma from "@/lib/prismaClient";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

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
  const latestArticles = await prisma.article.findMany({
    orderBy: {
      publicationDate: "desc",
    },
    take: 10,
    include: {
      feed: true,
    },
  });

  const feedWithUnreadArticleCount = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { read: false } },
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

      <Table>
        <TableCaption>Latest articles from your feeds.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Feed</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {latestArticles.map((article) => (
            <TableRow key={article.id}>
              <TableCell>
                <Link
                  className="hover:underline"
                  href={`/feed/${article.feedId}`}
                >
                  {article.feed.title}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  className="hover:underline"
                  href={article.link}
                  referrerPolicy="no-referrer"
                >
                  {article.title}
                </Link>
              </TableCell>
              <TableCell>
                <IntlRelativeTime date={article.publicationDate} />
              </TableCell>
              <TableCell>
                <Button className="h-8 w-8 p-0" variant="ghost">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Home;
