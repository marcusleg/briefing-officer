import ArticleMeta from "@/components/article/article-meta";
import ArticleSubpageActions from "@/components/article/article-subpage-actions";
import Chat from "@/components/chat/chat";
import IntlRelativeTime from "@/components/intl-relative-time";
import BackButton from "@/components/navigation/back-button";
import TopNavigation from "@/components/navigation/top-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { articleAuthor } from "@/lib/article";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

const TextSummary = async ({
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

  const heading = (
    <div className="flex flex-col gap-4">
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
      <ArticleMeta author={articleAuthor(article)} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
        <ArticleSubpageActions article={article} currentPage="text-summary" />
      </div>
    </div>
  );

  const navigation = (
    <TopNavigation
      segments={[
        { name: "Feeds", href: "/feed" },
        { name: article.feed.title, href: `/feed/${article.feed.id}` },
      ]}
      page="Text Summary"
    />
  );

  // A text summary is written from the article text alone.
  if (!article.scrape?.textContent) {
    return (
      <div className="m-2 flex flex-col gap-2">
        {navigation}
        <article className="max-w-content mx-auto flex w-full flex-col gap-4">
          {heading}
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Text summary unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so a text summary
              cannot be generated.
            </AlertDescription>
          </Alert>
        </article>
      </div>
    );
  }

  // The chat opens on the article and writes its text summary first. Like the
  // chat page, it fills the viewport so its prompt stays at the bottom: the
  // root layout's padding and this page's margin take 3rem.
  return (
    <div className="m-2 flex h-[calc(100svh-3rem)] min-h-0 flex-col gap-4">
      {navigation}
      <Chat
        // The text summary is in the article's language, so a voice for that
        // language reads it aloud, or else the browser's own voices.
        speechEngine={
          getSpeechModelFor(article.language) ? "server" : "browser"
        }
        article={{ id: article.id }}
        header={<div className="border-b pb-6">{heading}</div>}
      />
    </div>
  );
};

export default TextSummary;
