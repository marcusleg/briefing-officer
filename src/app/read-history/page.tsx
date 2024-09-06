import ArticleList from "@/components/article/ArticleList";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";

const getReadHistory = () => {
  return prisma.article.findMany({
    include: {
      aiTexts: true,
      feed: true,
      scrape: true,
    },
    where: {
      readAt: {
        not: null,
      },
    },
    orderBy: {
      readAt: "desc",
    },
    take: 50,
  });
};

const ReadHistoryPage = async () => {
  const articles = await getReadHistory();

  return (
    <div className="flex flex-col gap-4">
      <Typography variant="h2">Read History</Typography>

      <ArticleList articles={articles} />
    </div>
  );
};

export default ReadHistoryPage;
