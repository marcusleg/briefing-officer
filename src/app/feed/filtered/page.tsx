import FeedTitle from "@/app/feed/feed-title";
import NoFilteredArticles from "@/app/feed/filtered/no-filtered-articles";
import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import { ArticleScope, scopeWhere } from "@/lib/articleScope";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const FILTERED_SCOPE: ArticleScope = { statuses: ["FILTERED"] };

const FilteredPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  // Both rejection sources belong here: from the reader's side "filtered out by
  // the model" and "dismissed by hand" are one pile of things that did not make
  // the cut. Ordered by when that happened, and capped like History, because
  // this list only ever grows.
  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where: {
      ...scopeWhere(FILTERED_SCOPE),
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
        page="Filtered"
      />

      <FeedTitle title="Filtered" articleCount={articles.length} />

      <div className="flex flex-col gap-4">
        {articles.length > 0 ? (
          <ArticleList articles={articles} scope={FILTERED_SCOPE} />
        ) : (
          <NoFilteredArticles />
        )}
      </div>
    </div>
  );
};

export default FilteredPage;
