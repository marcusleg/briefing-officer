import DeleteCategoryButton from "@/app/feed/category/[categoryId]/delete-category-button";
import EditCategoryButton from "@/app/feed/category/[categoryId]/edit-category-button";
import MarkAsReadCategoryButton from "@/app/feed/category/[categoryId]/mark-as-read-button";
import RefreshCategoryButton from "@/app/feed/category/[categoryId]/refresh-category-button";
import NoUnreadArticles from "@/app/feed/no-unread-articles";
import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/navigation/TopNavigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          Unread articles in {category.name}
        </h2>
        <Badge variant="secondary" className="text-sm">
          {articles.length} articles
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-row flex-wrap items-center gap-2">
        <RefreshCategoryButton categoryId={categoryId} />
        <MarkAsReadCategoryButton
          disabled={articles.length === 0}
          categoryId={categoryId}
        />
        <EditCategoryButton category={category} />
        <DeleteCategoryButton category={category} />
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
