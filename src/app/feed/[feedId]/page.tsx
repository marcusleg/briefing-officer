import ArticleCard from "@/components/article/ArticleCard";
import AdditionalFeedActionsButton from "@/components/feed/AdditionalFeedActionsButton";
import FeedFilterButton from "@/components/feed/FeedFilterButton";
import RefreshFeedButton from "@/components/feed/RefreshFeedButton";
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
        <p className="text-sm text-muted-foreground">
          Last updated: {feed.lastFetched.toLocaleString()}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
};

export default Feed;
