import ArticleList from "@/components/article/ArticleList";
import AdditionalFeedActionsButton from "@/components/feed/AdditionalFeedActionsButton";
import FeedFilterButton from "@/components/feed/FeedFilterButton";
import RefreshFeedButton from "@/components/feed/RefreshFeedButton";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import Typography from "@/components/ui/typography";
import prisma from "@/lib/prismaClient";

const Feed = async ({
  params,
  searchParams,
}: {
  params: { feedId: string };
  searchParams: { show: "all" | "unread" };
}) => {
  const feedId = parseInt(params.feedId);
  const showSearchParam = searchParams["show"] || "unread";

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });
  const articles = await prisma.article.findMany({
    include: {
      aiSummary: true,
    },
    where: {
      feedId: feedId,
      read: showSearchParam === "all" ? undefined : false,
    },
    orderBy: { publicationDate: "desc" },
  });

  return (
    <div className="m-2">
      <Typography variant="h2">{feed.title}</Typography>
      <div className="my-4 flex flex-row items-center gap-4">
        <FeedFilterButton />
        <RefreshFeedButton feedId={feedId} />
        <AdditionalFeedActionsButton feedId={feedId} feedTitle={feed.title} />
        <time
          className="text-sm text-muted-foreground"
          dateTime={feed.lastFetched.toISOString()}
        >
          Last updated <IntlRelativeTime date={feed.lastFetched} />
        </time>
      </div>
      <ArticleList articles={articles} />
    </div>
  );
};

export default Feed;
