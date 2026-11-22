"use server";

import type { ArticleStatus } from "@/generated/prisma/client";
import { MAX_STATUS_CHANGE_IDS } from "@/lib/ai/chat/articleTools";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

export interface StatusChangeArticle {
  id: number;
  title: string;
  feed: string;
  /** `YYYY-MM-DD` */
  published: string;
  status: ArticleStatus;
}

export interface StatusChangeArticles {
  articles: StatusChangeArticle[];
  notFound: number;
}

/**
 * What the chat's confirmation card lists for a proposed status change. The
 * titles come from the database for the ids the tool will change, never from
 * the model's text, so the card cannot show one article while another changes.
 * Scoped to the signed-in reader like every server action.
 */
export const getArticlesForStatusChange = async (
  ids: number[],
): Promise<StatusChangeArticles> => {
  const userId = await getUserId();
  const unique = [...new Set(ids.filter(Number.isInteger))].slice(
    0,
    MAX_STATUS_CHANGE_IDS,
  );

  const rows = await prisma.article.findMany({
    where: { id: { in: unique }, userId },
    select: {
      id: true,
      title: true,
      status: true,
      publicationDate: true,
      feed: { select: { title: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const articles = unique.flatMap((id) => {
    const row = byId.get(id);
    return row
      ? [
          {
            id: row.id,
            title: row.title,
            feed: row.feed.title,
            published: row.publicationDate.toISOString().slice(0, 10),
            status: row.status,
          },
        ]
      : [];
  });

  return { articles, notFound: unique.length - articles.length };
};
