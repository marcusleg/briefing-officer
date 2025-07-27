import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/layout/TopNavigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
        segments={[{ name: "My Feed", href: "/feed" }]}
        page="History"
      />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">History</h2>
        <Badge variant="secondary" className="text-sm">
          {articles.length} articles
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <ArticleList articles={articles} />
      </div>
    </div>
  );
};

export default ReadHistoryPage;
