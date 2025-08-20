"use server";

import FeedTitle from "@/app/feed/feed-title";
import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

const ArticleSearchResultsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) => {
  const query = (await searchParams).q;

  const userId = await getUserId();

  const where = {
    AND: [
      { userId: { equals: userId } },
      {
        OR: [
          { title: { contains: query } },
          { scrape: { textContent: { contains: query } } },
        ],
      },
    ],
  };

  const articleCount = await prisma.article.count({ where });

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where,
    take: 20,
    orderBy: {
      publicationDate: "desc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "My Feed", href: "/feed" }]}
        page="Search Results"
      />

      <FeedTitle title="Search Results" articleCount={articleCount} />

      <ArticleList articles={articles} />
    </div>
  );
};

export default ArticleSearchResultsPage;
