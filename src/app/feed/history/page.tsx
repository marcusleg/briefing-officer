import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import { ArticleScope, scopeWhere } from "@/lib/articleScope";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import FeedTitle from "../feed-title";

const HISTORY_SCOPE: ArticleScope = { statuses: ["READ"] };

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
      ...scopeWhere(HISTORY_SCOPE),
      userId: session.user.id,
    },
    orderBy: {
      statusChangedAt: "desc",
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
        <ArticleList articles={articles} scope={HISTORY_SCOPE} />
      </div>
    </div>
  );
};

export default ReadHistoryPage;
