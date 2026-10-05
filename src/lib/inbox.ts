import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";

const include = {
  feed: true,
  lead: true,
  scrape: true,
} satisfies Prisma.ArticleInclude;

export type InboxArticle = Prisma.ArticleGetPayload<{
  include: typeof include;
}>;

export interface Inbox {
  unread: InboxArticle[];
  readLater: InboxArticle[];
}

/**
 * The home inbox: every unread article and every article saved for later,
 * each group newest first.
 *
 * Read Later articles are part of the inbox, listed below the unread ones,
 * so that saving an article for later does not hide it from the page the
 * reader triages on.
 *
 * Deliberately not `"use server"` and not in `articleRepository.ts`, which is:
 * an exported function there becomes a server action a client could call with
 * any `userId`. Only server components may import this module.
 */
export const getInboxArticles = async (userId: string): Promise<Inbox> => {
  const [unread, readLater] = await Promise.all([
    prisma.article.findMany({
      include,
      where: { status: "UNREAD", userId },
      orderBy: { publicationDate: "desc" },
    }),
    prisma.article.findMany({
      include,
      where: { status: "READ_LATER", userId },
      orderBy: { publicationDate: "desc" },
    }),
  ]);

  return { unread, readLater };
};
