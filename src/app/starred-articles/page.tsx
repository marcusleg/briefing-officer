import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/layout/TopNavigation";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const StarredArticlesPage = async () => {
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
      starred: true,
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "desc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "Home", href: "/" }]}
        page="Starred Articles"
      />

      <h2 className="text-3xl font-bold tracking-tight">Starred Articles</h2>

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
