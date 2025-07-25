import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/layout/TopNavigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const ReadHistoryPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
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
        segments={[{ name: "Home", href: "/" }]}
        page="Read History"
      />

      <h2 className="text-3xl font-bold tracking-tight">Read History</h2>

      <ArticleList articles={articles} />
    </div>
  );
};

export default ReadHistoryPage;
