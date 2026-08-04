"use server";

import ArticleMeta from "@/components/article/article-meta";
import AudioSummaryArticleActions from "@/components/article/audio-summary-article-actions";
import AudioSummaryPlayer from "@/components/article/audio-summary-player";
import IntlRelativeTime from "@/components/intl-relative-time";
import BackButton from "@/components/navigation/back-button";
import TopNavigation from "@/components/navigation/top-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

const AudioSummary = async (props0: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const params = await props0.params;
  const articleId = parseInt(params.articleId);

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
        page="Audio Summary"
      />

      <article className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="-ml-3 self-start">
          <BackButton />
        </div>
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
          <AudioSummaryPlayer
            articleId={article.id}
            author={article.scrape?.author}
            feedTitle={article.feed.title}
            title={article.title}
          />
        ) : (
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Audio summary unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so an audio briefing
              cannot be generated.
            </AlertDescription>
          </Alert>
        )}
        <div className="text-muted-foreground text-xs">
          Source: <Link href={article.link}>{article.link}</Link>
        </div>
        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:gap-2">
          <AudioSummaryArticleActions article={article} />
        </div>
      </article>
    </div>
  );
};

export default AudioSummary;
