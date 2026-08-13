import { ArticleStatus } from "@/generated/prisma/client";

/**
 * The author to display for an article.
 *
 * The author declared in the feed wins: the publisher stated it deliberately,
 * whereas Readability infers its byline from the article page and regularly
 * picks up a section name, a "share" link, or nothing at all. The scraped
 * byline is only a fallback for feeds that carry no author.
 *
 * The scraper stores "" when Readability finds no byline, so empty strings are
 * treated the same as a missing value.
 */
export const articleAuthor = (article: {
  author?: string | null;
  scrape?: { author: string } | null;
}): string | null =>
  article.author?.trim() || article.scrape?.author?.trim() || null;

/**
 * Whether an article's status still counts as being in the inbox — i.e. not
 * yet dismissed to a terminal state.
 *
 * `READ_LATER` belongs here alongside `UNREAD`: saving an article for later
 * does not remove it from the reader's queue, it just defers it. `READ`,
 * `FILTERED`, and `NOT_INTERESTED` are the states an article leaves the inbox
 * for.
 */
export const isInInbox = (status: ArticleStatus): boolean =>
  status === "UNREAD" || status === "READ_LATER";
