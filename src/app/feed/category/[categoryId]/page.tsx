import DeleteCategoryButton from "@/app/feed/category/[categoryId]/delete-category-button";
import EditCategoryButton from "@/app/feed/category/[categoryId]/edit-category-button";
import MarkAsReadCategoryButton from "@/app/feed/category/[categoryId]/mark-as-read-button";
import RefreshCategoryButton from "@/app/feed/category/[categoryId]/refresh-category-button";
import FeedTitle from "@/app/feed/feed-title";
import NoUnreadArticles from "@/app/feed/no-unread-articles";
import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { notFound } from "next/navigation";

interface FeedCategoryProps {
  params: Promise<{ categoryId: string }>;
}

const FeedCategory = async ({ params }: FeedCategoryProps) => {
  const categoryId = parseInt((await params).categoryId);

  const userId = await getUserId();

  const category = await prisma.feedCategory.findUnique({
    where: {
      id: categoryId,
      userId,
    },
    include: {
      feeds: true,
    },
  });

  if (!category) {
    return notFound();
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where: {
      readAt: null,
      readLater: false,
      userId,
      feedId: { in: category.feeds.map((feed) => feed.id) },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation page="All Feeds" />

      <div className="flex flex-col gap-2 xl:flex-row">
        <FeedTitle
          title={`Unread articles in ${category.name}`}
          articleCount={articles.length}
        />

        <div className="grow" />

        <div className="flex flex-row flex-wrap items-center gap-2">
          <RefreshCategoryButton categoryId={categoryId} />
          <MarkAsReadCategoryButton
            disabled={articles.length === 0}
            categoryId={categoryId}
          />
          <EditCategoryButton category={category} />
          <DeleteCategoryButton category={category} />
        </div>
      </div>

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <NoUnreadArticles />
      )}
    </div>
  );
};

export default FeedCategory;
