"use server";

import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/navigation/TopNavigation";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

const ArticleSearchResultsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) => {
  const query = (await searchParams).q;

  const userId = await getUserId();

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where: {
      AND: [
        { userId: { equals: userId } },
        {
          OR: [
            { title: { contains: query } },
            { scrape: { textContent: { contains: query } } },
          ],
        },
      ],
    },
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

      <h2 className="text-2xl font-bold tracking-tight">Search Results</h2>

      <ArticleList articles={articles} />
    </div>
  );
};

export default ArticleSearchResultsPage;
