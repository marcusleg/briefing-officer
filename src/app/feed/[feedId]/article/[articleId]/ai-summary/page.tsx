"use server";

import AiSummaryStream from "@/components/article/AiSummaryStream";
import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import TopNavigation from "@/components/layout/TopNavigation";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
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
          { name: "Home", href: "/" },
          { name: article.feed.title, href: `/feed/${article.feed.id}` },
        ]}
        page="AI Summary"
      />

      <article className="flex flex-col gap-4" data-testid="article">
        <Typography variant="h2">{article.title}</Typography>

        <ArticleCardActions article={article} hideAiSummary showBackButton />

        <AiSummaryStream articleId={article.id} />
      </article>
    </div>
  );
};

export default AiSummary;
