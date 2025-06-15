import ArticleList from "@/components/article/ArticleList";
import Typography from "@/components/ui/typography";
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
      aiTexts: true,
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
      <Typography variant="h2">Read History</Typography>

      <ArticleList articles={articles} />
    </div>
  );
};

export default ReadHistoryPage;
