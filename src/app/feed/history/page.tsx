import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import FeedTitle from "../feed-title";

const ReadHistoryPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where: {
      readAt: {
        not: null,
      },
      userId: session.user.id,
    },
    orderBy: {
      readAt: "desc",
    },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "Feeds", href: "/feed" }]}
        page="History"
      />

      <FeedTitle title="History" articleCount={articles.length} />

      <div className="flex flex-col gap-4">
        <ArticleList articles={articles} />
      </div>
    </div>
  );
};

export default ReadHistoryPage;
