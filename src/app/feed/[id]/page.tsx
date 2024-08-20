import prisma from "@/lib/prismaClient";
import RefreshFeedButton from "@/components/RefreshFeedButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

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
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        {feed.title}
      </h2>
      <div>
        <RefreshFeedButton feedId={feedId} />
        Last updated: {feed.lastFetched.toLocaleString()}
      </div>
      {articles.map((article) => (
        <Card key={article.id}>
          <CardHeader>
            <CardTitle>
              <Link href={article.link}>{article.title}</Link>
            </CardTitle>
            <CardDescription>
              {article.publicationDate.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>{article.description}</CardContent>
        </Card>
      ))}
    </>
  );
};

export default Feed;
