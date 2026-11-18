import logger from "@/lib/logger";
import Database from "better-sqlite3";
import { rmSync } from "fs";
import { basename, dirname, extname, join } from "path";

/**
 * Full-text index over every user's articles, kept in its own SQLite file.
 *
 * It is not in the main database because Prisma reads the shadow tables an
 * FTS5 table creates (`article_fts_data`, `_idx`, `_docsize`, `_config`) as
 * schema drift and `migrate dev` would drop them. Everything in here is derived
 * from the main database, so the file may be deleted at any time;
 * `syncSearchIndex` (articleIndexing.ts) refills it.
 */

export interface SearchDocument {
  articleId: number;
  userId: string;
  title: string;
  lead: string;
  body: string;
  published: Date;
}

export type SearchSort = "relevance" | "newest" | "oldest";

export interface SearchOptions {
  /** Inclusive, `YYYY-MM-DD` in UTC. */
  from?: string;
  /** Inclusive, `YYYY-MM-DD` in UTC. */
  to?: string;
  sort: SearchSort;
  limit: number;
}

export interface SearchHit {
  articleId: number;
  snippet: string;
}

// `published` holds an ISO 8601 string, so its first ten characters compare
// as dates. The rowid is the article id.
const SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS article_fts USING fts5(
    title, lead, body, user_id UNINDEXED, published UNINDEXED,
    tokenize = 'porter unicode61 remove_diacritics 2'
  )`;

// bm25() returns lower-is-better scores; weights follow column order
// (title, lead, body), so a title hit counts most.
const ORDER_BY: Record<SearchSort, string> = {
  relevance: "bm25(article_fts, 10.0, 5.0, 1.0)",
  newest: "published DESC, rowid DESC",
  oldest: "published ASC, rowid ASC",
};

/** `file:./data/database.sqlite` → `data/database.search.sqlite`. */
export const searchIndexPath = (
  databaseUrl = process.env.DATABASE_URL ?? "",
) => {
  const databasePath = databaseUrl.replace(/^file:/, "");
  if (!databasePath) {
    throw new Error("DATABASE_URL is not set.");
  }
  const extension = extname(databasePath);
  return join(
    dirname(databasePath),
    `${basename(databasePath, extension)}.search${extension || ".sqlite"}`,
  );
};

/**
 * The worker and scheduler (instrumentation) and the chat route load this
 * module in separate module graphs. With a connection per graph, a recovery in
 * one deletes the file while the other keeps writing to the unlinked one, so
 * the connection lives on `globalThis`, which every graph in the process
 * shares.
 */
const GLOBAL_KEY = "__briefingOfficerSearchIndex";

type GlobalWithConnection = typeof globalThis & {
  [GLOBAL_KEY]?: Database.Database;
};

const shared = globalThis as GlobalWithConnection;

const open = () => {
  const database = new Database(searchIndexPath());
  try {
    database.pragma("journal_mode = WAL");
    database.exec(SCHEMA);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
};

const isCorruption = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === "string" &&
    (code.startsWith("SQLITE_CORRUPT") || code === "SQLITE_NOTADB")
  );
};

/**
 * Runs `fn` against the index. A corrupt or foreign file is deleted and
 * recreated once; the next sync refills it.
 */
const withIndex = <T>(fn: (database: Database.Database) => T): T => {
  try {
    shared[GLOBAL_KEY] ??= open();
    return fn(shared[GLOBAL_KEY]);
  } catch (error) {
    if (!isCorruption(error)) {
      throw error;
    }
    logger.error({ err: error }, "Search index is corrupt; recreating it.");
    closeSearchIndex();
    const path = searchIndexPath();
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(`${path}${suffix}`, { force: true });
    }
    const connection = open();
    shared[GLOBAL_KEY] = connection;
    return fn(connection);
  }
};

/**
 * Builds an FTS5 query the model cannot break: every term becomes a quoted
 * phrase (so `AND`, `NEAR(`, `*` and stray quotes are plain text) and the
 * phrases are OR-ed. BM25 then ranks articles matching more of them higher.
 */
export const toMatchQuery = (terms: string[]) =>
  terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" OR ");

export const upsertDocuments = (documents: SearchDocument[]) =>
  withIndex((database) => {
    const insert = database.prepare(
      `INSERT OR REPLACE INTO article_fts (rowid, title, lead, body, user_id, published)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    database.transaction(() => {
      for (const document of documents) {
        insert.run(
          document.articleId,
          document.title,
          document.lead,
          document.body,
          document.userId,
          document.published.toISOString(),
        );
      }
    })();
  });

/**
 * Inserts documents whose rowid is absent and leaves existing rows alone. The
 * sync loads articles asynchronously, so a document may be stale by the time it
 * is written; a row indexed meanwhile (with scraped text) must not be replaced.
 */
export const insertMissingDocuments = (documents: SearchDocument[]) =>
  withIndex((database) => {
    const insert = database.prepare(
      `INSERT INTO article_fts (rowid, title, lead, body, user_id, published)
       SELECT @articleId, @title, @lead, @body, @userId, @published
       WHERE NOT EXISTS (SELECT 1 FROM article_fts WHERE rowid = @articleId)`,
    );
    database.transaction(() => {
      for (const document of documents) {
        insert.run({
          articleId: document.articleId,
          title: document.title,
          lead: document.lead,
          body: document.body,
          userId: document.userId,
          published: document.published.toISOString(),
        });
      }
    })();
  });

export const deleteDocuments = (articleIds: number[]) =>
  withIndex((database) => {
    const remove = database.prepare("DELETE FROM article_fts WHERE rowid = ?");
    database.transaction(() => {
      for (const id of articleIds) {
        remove.run(id);
      }
    })();
  });

export const indexedArticleIds = (): number[] =>
  withIndex(
    (database) =>
      database
        .prepare("SELECT rowid FROM article_fts ORDER BY rowid")
        .pluck()
        .all() as number[],
  );

export const searchDocuments = (
  userId: string,
  terms: string[],
  options: SearchOptions,
): SearchHit[] => {
  const match = toMatchQuery(terms);
  if (!match) {
    return [];
  }

  return withIndex(
    (database) =>
      database
        .prepare(
          `SELECT rowid AS articleId,
                  snippet(article_fts, -1, '', '', '…', 24) AS snippet
           FROM article_fts
           WHERE article_fts MATCH @match
             AND user_id = @userId
             AND (@from IS NULL OR substr(published, 1, 10) >= @from)
             AND (@to IS NULL OR substr(published, 1, 10) <= @to)
           ORDER BY ${ORDER_BY[options.sort]}
           LIMIT @limit`,
        )
        .all({
          match,
          userId,
          from: options.from ?? null,
          to: options.to ?? null,
          limit: options.limit,
        }) as SearchHit[],
  );
};

export const clearSearchIndex = () =>
  withIndex((database) => {
    database.exec("DELETE FROM article_fts");
  });

export const closeSearchIndex = () => {
  shared[GLOBAL_KEY]?.close();
  shared[GLOBAL_KEY] = undefined;
};
