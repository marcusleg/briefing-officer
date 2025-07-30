"use server";

import AiSummaryStream from "@/components/article/AiSummaryStream";
import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import TopNavigation from "@/components/navigation/TopNavigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

const AiSummary = async (props0: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const params = await props0.params;
  let articleId = parseInt(params.articleId);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  const article = await prisma.article.findUnique({
    include: {
      feed: true,
      scrape: true,
    },
    where: {
      id: articleId,
      userId: session.user.id,
    },
  });
  if (!article) {
    notFound();
  }

  return (
    <div className="m-2 flex flex-col gap-2">
      <TopNavigation
        segments={[
          { name: "My Feed", href: "/feed" },
          { name: article.feed.title, href: `/feed/${article.feed.id}` },
        ]}
        page="AI Summary"
      />

      <article className="flex flex-col gap-4" data-testid="article">
        <h2 className="text-2xl font-bold tracking-tight">{article.title}</h2>

        <ArticleCardActions article={article} hideAiSummary showBackButton />

        <AiSummaryStream articleId={article.id} />

        <div className="text-sm text-muted-foreground">
          Source: <Link href={article.link}>{article.link}</Link>
        </div>
      </article>
    </div>
  );
};

export default AiSummary;
