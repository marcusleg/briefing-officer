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
    <div className="m-2">
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        {feed.title}
      </h2>
      <div className="flex flex-row gap-4 items-center my-4">
        <RefreshFeedButton feedId={feedId} />
        Last updated: {feed.lastFetched.toLocaleString()}
      </div>
      <div className="flex flex-col gap-4">
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
      </div>
    </div>
  );
};

export default Feed;
