import DeleteFeedButton from "@/app/feed/[feedId]/delete-feed-button";
import EditFeedButton from "@/app/feed/[feedId]/edit-feed-button";
import FeedFilterButton from "@/app/feed/[feedId]/feed-filter-button";
import MarkAsReadButton from "@/app/feed/[feedId]/mark-as-read-button";
import NoUnreadArticles from "@/app/feed/[feedId]/no-unread-articles";
import RefreshFeedButton from "@/app/feed/[feedId]/refresh-feed-button";
import ArticleList from "@/components/article/ArticleList";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import TopNavigation from "@/components/navigation/TopNavigation";
import { Badge } from "@/components/ui/badge";
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{feed.title}</h2>
        <Badge variant="secondary" className="text-sm">
          {articles.length} articles
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-row flex-wrap items-center gap-2">
        <FeedFilterButton />
        <RefreshFeedButton feedId={feedId} />
        <MarkAsReadButton disabled={articles.length === 0} feedId={feedId} />
        <EditFeedButton feed={feed} />
        <DeleteFeedButton feed={feed} />
        <time
          className="text-sm text-muted-foreground"
          dateTime={feed.lastFetched.toISOString()}
        >
          Last updated <IntlRelativeTime date={feed.lastFetched} />
        </time>
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
