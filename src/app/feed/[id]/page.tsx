import prisma from "@/lib/prismaClient";
import { refreshFeed } from "@/app/actions";
import RefreshFeedButton from "@/components/RefreshFeedButton";

const Feed = async ({ params }: { params: { id: string } }) => {
  const feedId = parseInt(params.id);

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });
  const articles = await prisma.article.findMany({
    where: { feedId: feedId },
  });

  return (
    <>
      <h2>{feed.title}</h2>
      <div>
        <RefreshFeedButton feedId={feedId} />
        Last updated: {feed.lastFetched.toLocaleString()}
      </div>
      {articles.map((article) => (
        <article key={article.id}>
          <h2>
            <a href={article.link}>{article.title}</a>
          </h2>
          <p>{article.publicationDate.toLocaleString()}</p>
          <p>{article.description}</p>
        </article>
      ))}
    </>
  );
};

export default Feed;
