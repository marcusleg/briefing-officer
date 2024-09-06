import ArticleList from "@/components/article/ArticleList";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";

const getStarredArticles = () => {
  return prisma.article.findMany({
    include: {
      aiTexts: true,
      feed: true,
      scrape: true,
    },
    where: {
      starred: true,
    },
    orderBy: {
      publicationDate: "desc",
    },
  });
};

const StarredArticlesPage = async () => {
  const articles = await getStarredArticles();

  return (
    <div className="flex flex-col gap-4">
      <Typography variant="h2">Read Later</Typography>

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <Typography
          variant="p"
          className="my-8 text-center text-lg text-muted-foreground"
        >
          You haven&apos;t starred any articles yet.
        </Typography>
      )}
    </div>
  );
};

export default StarredArticlesPage;
