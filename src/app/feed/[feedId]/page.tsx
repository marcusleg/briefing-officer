import DeleteFeedButton from "@/app/feed/[feedId]/delete-feed-button";
import EditFeedButton from "@/app/feed/[feedId]/edit-feed-button";
import FeedFilterButton from "@/app/feed/[feedId]/feed-filter-button";
import MarkAsReadButton from "@/app/feed/[feedId]/mark-as-read-button";
import NoUnreadArticles from "@/app/feed/[feedId]/no-unread-articles";
import RefreshFeedButton from "@/app/feed/[feedId]/refresh-feed-button";
import FeedTitle from "@/app/feed/feed-title";
import ArticleList from "@/components/article/ArticleList";
import TopNavigation from "@/components/navigation/TopNavigation";
import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { notFound } from "next/navigation";

interface FeedByIdProps {
  params: Promise<{ feedId: string }>;
  searchParams: Promise<{ show: "all" | "unread" }>;
}

const FeedById = async (props: FeedByIdProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const feedId = parseInt(params.feedId);
  const showSearchParam = searchParams["show"] || "unread";

  const userId = await getUserId();

  const feed = await prisma.feed.findUnique({
    where: { id: feedId, userId },
  });
  if (!feed) {
    notFound();
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where: {
      feedId: feedId,
      readAt: showSearchParam === "all" ? undefined : null,
      readLater: false,
      userId,
    },
    orderBy: { publicationDate: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "My Feed", href: "/feed" }]}
        page={feed.title}
      />

      <div>
        <FeedTitle
          title={feed.title}
          articleCount={articles.length}
          lastUpdated={feed.lastFetched}
        />
      </div>

      <Separator />

      <div className="flex flex-row flex-wrap items-center gap-2">
        <FeedFilterButton />
        <RefreshFeedButton feedId={feedId} />
        <MarkAsReadButton disabled={articles.length === 0} feedId={feedId} />
        <EditFeedButton feed={feed} />
        <DeleteFeedButton feed={feed} />
      </div>

      <div className="flex flex-col gap-4">
        {articles.length > 0 ? (
          <ArticleList articles={articles} />
        ) : (
          <NoUnreadArticles feed={feed} />
        )}
      </div>
    </div>
  );
};

export default FeedById;
