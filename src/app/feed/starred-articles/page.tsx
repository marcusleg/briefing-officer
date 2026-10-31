import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import Typography from "@/components/ui/typography";
import { ArticleScope, scopeWhere } from "@/lib/articleScope";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import FeedTitle from "../feed-title";

const STARRED_SCOPE: ArticleScope = { starredOnly: true };

const StarredArticlesPage = async () => {
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
      ...scopeWhere(STARRED_SCOPE),
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "desc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "Feeds", href: "/feed" }]}
        page="Starred Articles"
      />

      <FeedTitle title="Starred Articles" articleCount={articles.length} />

      <div className="flex flex-col gap-4">
        {articles.length > 0 ? (
          <ArticleList articles={articles} scope={STARRED_SCOPE} />
        ) : (
          <Typography
            variant="p"
            className="text-muted-foreground my-8 text-center text-lg"
          >
            You haven&apos;t starred any articles yet.
          </Typography>
        )}
      </div>
    </div>
  );
};

export default StarredArticlesPage;
