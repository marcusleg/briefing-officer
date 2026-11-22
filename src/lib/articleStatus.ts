import type { ArticleStatus, Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";

/**
 * The only writers of `status` and `statusChangedAt`. Pairing the two writes
 * here is what lets History treat `statusChangedAt` as the read timestamp: for
 * a READ article it is, by construction, the moment it became read. Anything
 * that writes one without the other breaks that.
 *
 * `filterReason` is optional and only ever set alongside `FILTERED`. It is
 * accepted here rather than written separately so a rejection cannot land as a
 * status without its explanation.
 *
 * Every write is scoped to `userId`: an article that is not theirs fails the
 * update just like a missing one. Callers pass the id of the signed-in reader;
 * this module must never be imported by a `"use server"` module that exports
 * these functions, or a browser could pass any user id.
 */
export const setArticleStatusForUser = (
  userId: string,
  articleId: number,
  status: ArticleStatus,
  filterReason?: string,
) =>
  prisma.article.update({
    where: { id: articleId, userId },
    data: {
      status,
      statusChangedAt: new Date(),
      ...(filterReason === undefined ? {} : { filterReason }),
    },
  });

/** Like `setArticleStatusForUser` for many articles; `userId` overrides `where`. */
export const setArticleStatusManyForUser = (
  userId: string,
  where: Prisma.ArticleWhereInput,
  status: ArticleStatus,
) =>
  prisma.article.updateMany({
    where: { ...where, userId },
    data: { status, statusChangedAt: new Date() },
  });
