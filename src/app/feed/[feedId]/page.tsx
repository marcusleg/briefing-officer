import ArticleList from "@/components/article/ArticleList";
import DeleteFeedButton from "@/components/feed/DeleteFeedButton";
import EditFeedButton from "@/components/feed/EditFeedButton";
import FeedFilterButton from "@/components/feed/FeedFilterButton";
import MarkAsReadButton from "@/components/feed/MarkAsReadButton";
import RefreshFeedButton from "@/components/feed/RefreshFeedButton";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import TopNavigation from "@/components/layout/TopNavigation";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
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

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  const feed = await prisma.feed.findUnique({
    where: { id: feedId, userId: session.user.id },
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
    },
    orderBy: { publicationDate: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "Home", href: "/" }]}
        page={feed.title}
      />

      <div>
        <h2 className="text-3xl font-bold tracking-tight">{feed.title}</h2>

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
