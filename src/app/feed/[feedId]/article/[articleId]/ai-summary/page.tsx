"use server";

import AiSummaryStream from "@/components/article/ai-summary-stream";
import ArticleCardActions from "@/components/article/article-card-actions";
import ArticleMeta from "@/components/article/article-meta";
import IntlRelativeTime from "@/components/intl-relative-time";
import TopNavigation from "@/components/navigation/top-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
          { name: "Feeds", href: "/feed" },
          { name: article.feed.title, href: `/feed/${article.feed.id}` },
        ]}
        page="AI Summary"
      />

      <article className="mx-auto flex max-w-4xl flex-col gap-4">
        <ArticleCardActions article={article} hideAiSummary showBackButton />

        <div className="flex items-baseline gap-2 text-base">
          <span className="text-muted-foreground font-semibold tracking-wide uppercase">
            {article.feed.title}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            <IntlRelativeTime date={article.publicationDate} />
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight">{article.title}</h2>

        <ArticleMeta author={article.scrape?.author} />

        {article.scrape ? (
          <AiSummaryStream articleId={article.id} />
        ) : (
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Summary unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so an AI summary
              cannot be generated.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-muted-foreground text-sm">
          Source: <Link href={article.link}>{article.link}</Link>
        </div>
      </article>
    </div>
  );
};

export default AiSummary;
