"use server";

import AiSummaryStream from "@/components/article/AiSummaryStream";
import { ArticleCardActions } from "@/components/article/ArticleCardActions";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import { notFound, unauthorized } from "next/navigation";

const AiSummary = async (props0: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const params = await props0.params;
  let articleId = parseInt(params.articleId);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    unauthorized();
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
      <ArticleCardActions article={article} hideAiSummary showBackButton />

      <article>
        <AiSummaryStream articleId={articleId} />
      </article>
    </div>
  );
};

export default AiSummary;
