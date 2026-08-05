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
