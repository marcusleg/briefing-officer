import type { Prisma } from "@/generated/prisma/client";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import {
  deleteDocuments,
  indexedArticleIds,
  insertMissingDocuments,
  upsertDocuments,
  type SearchDocument,
} from "@/lib/search/searchIndex";
import { setImmediate as yieldToEventLoop } from "timers/promises";

const BATCH_SIZE = 500;

type IndexableArticle = Prisma.ArticleGetPayload<{
  include: { lead: true; scrape: true };
}>;

const toSearchDocument = (article: IndexableArticle): SearchDocument => ({
  articleId: article.id,
  userId: article.userId,
  title: article.title,
  lead: article.lead?.text ?? "",
  body: article.scrape?.textContent ?? article.description ?? "",
  published: article.publicationDate,
});

/** Indexes (or re-indexes) one article. Missing articles are ignored. */
export const indexArticle = async (articleId: number) => {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { lead: true, scrape: true },
  });
  if (!article) {
    return;
  }
  upsertDocuments([toSearchDocument(article)]);
};

/**
 * Makes the index match the articles table: rows for deleted articles go,
 * articles without a row are indexed. Deletions happen in several places (the
 * retention purge, deleting a feed, deleting a user), and this one pass covers
 * all of them, as well as a new or recreated index file.
 */
export const syncSearchIndex = async () => {
  const articleIds = (
    await prisma.article.findMany({ select: { id: true } })
  ).map((article) => article.id);
  const existing = new Set(articleIds);
  const indexed = new Set(indexedArticleIds());

  const stale = [...indexed].filter((id) => !existing.has(id));
  const missing = articleIds.filter((id) => !indexed.has(id));

  deleteDocuments(stale);

  for (let start = 0; start < missing.length; start += BATCH_SIZE) {
    const batch = await prisma.article.findMany({
      where: { id: { in: missing.slice(start, start + BATCH_SIZE) } },
      include: { lead: true, scrape: true },
    });
    insertMissingDocuments(batch.map(toSearchDocument));
    // better-sqlite3 blocks; let requests through between batches.
    await yieldToEventLoop();
  }

  const result = { added: missing.length, removed: stale.length };
  if (result.added + result.removed > 0) {
    logger.info(result, "Synchronized search index.");
  }
  return result;
};
