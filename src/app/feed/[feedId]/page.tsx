import ArticleList from "@/components/article/ArticleList";
import DeleteFeedButton from "@/components/feed/DeleteFeedButton";
import EditFeedButton from "@/components/feed/EditFeedButton";
import FeedFilterButton from "@/components/feed/FeedFilterButton";
import MarkAsReadButton from "@/components/feed/MarkAsReadButton";
import RefreshFeedButton from "@/components/feed/RefreshFeedButton";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import TopNavigation from "@/components/navigation/TopNavigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { notFound } from "next/navigation";

interface FeedProps {
  params: Promise<{ feedId: string }>;
  searchParams: Promise<{ show: "all" | "unread" }>;
}

const Feed = async (props: FeedProps) => {
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

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">{feed.title}</h2>
          <Badge variant="secondary" className="text-sm">
            {articles.length} articles
          </Badge>
        </div>

        <Separator />

        <div className="my-4 flex flex-row flex-wrap items-center gap-2">
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
            <Typography
              variant="p"
              className="my-8 text-center text-lg text-muted-foreground"
            >
              There are no {showSearchParam === "unread" && "unread"} articles.
            </Typography>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
