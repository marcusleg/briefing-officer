import ArticleSubpageActions from "@/components/article/article-subpage-actions";
import AudioBriefingPlayer from "@/components/article/audio-briefing-player";
import IntlRelativeTime from "@/components/intl-relative-time";
import BackButton from "@/components/navigation/back-button";
import TopNavigation from "@/components/navigation/top-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const maxDuration = 30;

const AudioBriefingPage = async ({
  params,
}: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const articleId = parseInt((await params).articleId);

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
        page="Audio Briefing"
      />

      <article className="max-w-content mx-auto flex w-full flex-col gap-4">
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
        <h2 className="text-[1.728rem] leading-tight font-bold tracking-[-0.02em] text-balance">
          {article.title}
        </h2>
        {article.scrape ? (
          <AudioBriefingPlayer
            articleId={article.id}
            // A configured voice for the article's language reads it;
            // otherwise the browser's own voices do.
            engine={getSpeechModelFor(article.language) ? "server" : "browser"}
            language={article.language}
            title={article.title}
          />
        ) : (
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Audio briefing unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so an audio briefing
              cannot be generated.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:gap-2">
          <ArticleSubpageActions
            article={article}
            currentPage="audio-briefing"
          />
        </div>
      </article>
    </div>
  );
};

export default AudioBriefingPage;
