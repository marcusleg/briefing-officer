import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/layout/TopNavigation";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const ReadLaterPage = async () => {
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
      readLater: true,
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "asc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation page="Read Later" />

      <h2 className="text-3xl font-bold tracking-tight">Read Later</h2>

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
