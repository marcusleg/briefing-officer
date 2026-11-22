"use server";

import type { ArticleStatus } from "@/generated/prisma/client";
import { MAX_STATUS_CHANGE_IDS } from "@/lib/ai/chat/articleTools";
import { isArticleId } from "@/lib/articleId";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";

/** Far more than one conversation cites; bounds what one call looks up. */
const MAX_SOURCE_IDS = 200;

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

/** The link as the browser will read it, if it is a web address. */
const webUrl = (link: string) => {
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The source URLs of the reader's articles that a chat answer cites, by
 * article id. The chat links a citation to its source from here rather than
 * from the model's text, so a hostile article cannot steer a citation to
 * another site. Links that are not web addresses are left out, as are other
 * readers' articles.
 */
export const getArticleSources = async (
  ids: number[],
): Promise<Record<number, string>> => {
  const userId = await getUserId();
  const unique = [...new Set(ids.filter(isArticleId))].slice(0, MAX_SOURCE_IDS);

  const rows = await prisma.article.findMany({
    where: { id: { in: unique }, userId },
    select: { id: true, link: true },
  });

  return Object.fromEntries(
    rows.flatMap((row) => {
      const url = webUrl(row.link);
      return url ? [[row.id, url]] : [];
    }),
  );
};
