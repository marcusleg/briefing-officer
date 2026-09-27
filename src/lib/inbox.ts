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

/**
 * The home inbox: every unread article, then every article saved for later,
 * each group newest first.
 *
 * Read Later articles are listed here, below the unread ones, so that saving
 * an article for later does not hide it from the page the reader triages on.
 *
 * Two queries rather than one sorted by `status`: SQLite stores the enum as
 * text, so a status sort would only get the groups in order by accident of
 * spelling.
 *
 * Deliberately not `"use server"` and not in `articleRepository.ts`, which is:
 * an exported function there becomes a server action a client could call with
 * any `userId`. Only server components may import this module.
 */
export const getInboxArticles = async (
  userId: string,
): Promise<InboxArticle[]> => {
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

  return [...unread, ...readLater];
};
