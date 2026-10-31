import { ArticleStatus, Prisma } from "@/generated/prisma/client";

/**
 * Which articles a list page shows, as far as the reader's own actions can
 * change it: by status, and optionally only starred ones.
 *
 * A page builds its database query from its scope and hands the same scope to
 * `ArticleList`, which uses it to drop an article the moment the reader
 * changes it out of the page — before the server confirms, and while offline.
 * Keeping both in one value is what stops the query and the on-screen list
 * from disagreeing about what belongs.
 *
 * A plain object rather than a predicate, because server components pass it
 * to a client component and functions do not cross that boundary.
 */
export interface ArticleScope {
  /** Omitted: any status. */
  statuses?: ArticleStatus[];
  starredOnly?: boolean;
}

/** The home inbox: unread articles, then those saved for later. */
export const INBOX_SCOPE: ArticleScope = {
  statuses: ["UNREAD", "READ_LATER"],
};

export const scopeWhere = (scope: ArticleScope): Prisma.ArticleWhereInput => ({
  ...(scope.statuses ? { status: { in: scope.statuses } } : {}),
  ...(scope.starredOnly ? { starred: true } : {}),
});

export const isInScope = (
  scope: ArticleScope,
  article: { status: ArticleStatus; starred: boolean },
): boolean =>
  (scope.statuses === undefined || scope.statuses.includes(article.status)) &&
  (!scope.starredOnly || article.starred);
