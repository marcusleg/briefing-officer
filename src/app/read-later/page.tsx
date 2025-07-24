import ArticleList from "@/components/article/ArticleList";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";

const ReadLaterPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    unauthorized();
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      scrape: true,
    },
    where: {
      readLater: true,
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "asc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Typography variant="h2">Read Later</Typography>

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <Typography
          variant="p"
          className="my-8 text-center text-lg text-muted-foreground"
        >
          Congratulations! Your read later list is empty.
        </Typography>
      )}
    </div>
  );
};

export default ReadLaterPage;
