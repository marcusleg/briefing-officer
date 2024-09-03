import ArticleList from "@/components/article/ArticleList";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";

const getReadLaterArticles = () => {
  return prisma.article.findMany({
    include: {
      aiSummary: true,
      feed: true,
      readability: true,
    },
    where: {
      readLater: true,
    },
    orderBy: {
      publicationDate: "asc",
    },
  });
};

const ReadLaterPage = async () => {
  const articles = await getReadLaterArticles();

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
          Congratulations! Your read later list is empty.
        </Typography>
      )}
    </div>
  );
};

export default ReadLaterPage;
