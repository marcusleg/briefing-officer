import ArticleMeta from "@/components/article/article-meta";
import ArticleSubpageActions from "@/components/article/article-subpage-actions";
import TextSummaryStream from "@/components/article/text-summary-stream";
import Chat from "@/components/chat/chat";
import IntlRelativeTime from "@/components/intl-relative-time";
import BackButton from "@/components/navigation/back-button";
import TopNavigation from "@/components/navigation/top-navigation";
import PrototypeSwitcher from "@/components/prototype/prototype-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { articleAuthor } from "@/lib/article";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const maxDuration = 30;

// PROTOTYPE (chat-based summary spike): three takes on the summary page,
// switchable with `?variant=`. A is today's page, B generates the summary
// in an embedded chat on the page, C hands the article to a full chat.
const VARIANTS = [
  { key: "A", name: "Today's summary" },
  { key: "B", name: "Embedded chat" },
  { key: "C", name: "Full chat" },
];

const TextSummary = async ({
  params,
  searchParams,
}: {
  params: Promise<{ feedId: string; articleId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) => {
  const articleId = parseInt((await params).articleId);
  const variant = (await searchParams).variant ?? "B";
  const speechEngine = getSpeechModelFor(null) ? "server" : "browser";

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

  const switcher = <PrototypeSwitcher variants={VARIANTS} current={variant} />;

  const articleHeading = (
    <>
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
    </>
  );

  if (variant === "C" && article.scrape) {
    return (
      <div className="m-2 flex h-[calc(100svh-3rem)] min-h-0 flex-col gap-4">
        <TopNavigation
          segments={[
            { name: "Feeds", href: "/feed" },
            { name: article.feed.title, href: `/feed/${article.feed.id}` },
          ]}
          page="Text Summary"
        />
        <Chat
          key={variant}
          speechEngine={speechEngine}
          article={{ id: article.id, title: article.title }}
          header={
            <div className="flex flex-col gap-4 border-b pb-6">
              {articleHeading}
            </div>
          }
        />
        {switcher}
      </div>
    );
  }

  return (
    <div className="m-2 flex flex-col gap-2">
      <TopNavigation
        segments={[
          { name: "Feeds", href: "/feed" },
          { name: article.feed.title, href: `/feed/${article.feed.id}` },
        ]}
        page="Text Summary"
      />

      <article className="max-w-content mx-auto flex w-full flex-col gap-4">
        <div className="-ml-3 self-start">
          <BackButton />
        </div>
        {articleHeading}
        {article.scrape ? (
          <div>
            {variant === "A" ? (
              <TextSummaryStream articleId={article.id} />
            ) : (
              <Chat
                key={variant}
                inline
                hideSummaryRequest
                speechEngine={speechEngine}
                article={{ id: article.id, title: article.title }}
                answerClassName="flex flex-col gap-4 space-y-0 [&>*]:my-0"
              />
            )}
          </div>
        ) : (
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Text summary unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so a text summary
              cannot be generated.
            </AlertDescription>
          </Alert>
        )}
        <div className="text-muted-foreground text-xs">
          Source: <Link href={article.link}>{article.link}</Link>
        </div>
        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:gap-2">
          <ArticleSubpageActions article={article} currentPage="text-summary" />
        </div>
      </article>
      {switcher}
    </div>
  );
};

export default TextSummary;
