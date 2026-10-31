import FeedTitle from "@/app/feed/feed-title";
import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import Typography from "@/components/ui/typography";
import { ArticleScope, scopeWhere } from "@/lib/articleScope";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const READ_LATER_SCOPE: ArticleScope = { statuses: ["READ_LATER"] };

const ReadLaterPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      lead: true,
      scrape: true,
    },
    where: {
      ...scopeWhere(READ_LATER_SCOPE),
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "asc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "Feeds", href: "/feed" }]}
        page="Read Later"
      />

      <FeedTitle title="Read Later" articleCount={articles.length} />

      {articles.length > 0 ? (
        <ArticleList articles={articles} scope={READ_LATER_SCOPE} />
      ) : (
        <Typography
          variant="p"
          className="text-muted-foreground my-8 text-center text-lg"
        >
          Congratulations! Your read later list is empty.
        </Typography>
      )}
    </div>
  );
};

export default ReadLaterPage;
