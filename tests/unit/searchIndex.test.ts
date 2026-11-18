import {
  clearSearchIndex,
  closeSearchIndex,
  deleteDocuments,
  indexedArticleIds,
  insertMissingDocuments,
  searchDocuments,
  searchIndexPath,
  toMatchQuery,
  upsertDocuments,
  type SearchDocument,
} from "@/lib/search/searchIndex";
import { rmSync, writeFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const doc = (
  overrides: Partial<SearchDocument> & { articleId: number },
): SearchDocument => ({
  userId: "user-1",
  title: "Untitled",
  lead: "",
  body: "",
  published: new Date("2026-06-01T12:00:00Z"),
  ...overrides,
});

const relevance = { sort: "relevance" as const, limit: 10 };

beforeEach(() => {
  clearSearchIndex();
});

describe("searchIndexPath", () => {
  it("puts the index next to the database with a .search infix", () => {
    expect(searchIndexPath("file:/data/database.sqlite")).toBe(
      "/data/database.search.sqlite",
    );
    expect(searchIndexPath("file:./.tmp/test-0.db")).toBe(
      ".tmp/test-0.search.db",
    );
  });
});

describe("insertMissingDocuments", () => {
  it("adds absent rows but never replaces an indexed one", () => {
    upsertDocuments([
      doc({ articleId: 1, title: "Full", body: "scraped text" }),
    ]);

    insertMissingDocuments([
      doc({ articleId: 1, title: "Stale", body: "description only" }),
      doc({ articleId: 2, title: "New", body: "fresh" }),
    ]);

    expect(indexedArticleIds()).toEqual([1, 2]);
    expect(
      searchDocuments("user-1", ["scraped"], relevance).map((h) => h.articleId),
    ).toEqual([1]);
    expect(searchDocuments("user-1", ["description"], relevance)).toEqual([]);
  });
});

describe("toMatchQuery", () => {
  it("quotes each term and joins them with OR", () => {
    expect(toMatchQuery(["Alphabet", "GOOGL stock"])).toBe(
      '"Alphabet" OR "GOOGL stock"',
    );
  });

  it("neutralizes quotes and FTS operators", () => {
    expect(toMatchQuery(['say "hi"', "a AND b", "x*", "  "])).toBe(
      '"say ""hi""" OR "a AND b" OR "x*"',
    );
  });
});

describe("searchDocuments", () => {
  it("finds stemmed matches and returns a snippet", () => {
    upsertDocuments([
      doc({
        articleId: 1,
        title: "Presenting to your audience",
        body: "Define the target audience before writing a single slide.",
      }),
    ]);

    const hits = searchDocuments("user-1", ["presentation"], relevance);

    expect(hits).toEqual([
      { articleId: 1, snippet: expect.stringContaining("Presenting") },
    ]);
  });

  it("does not choke on operator-like input", () => {
    upsertDocuments([doc({ articleId: 1, body: "a AND b" })]);

    expect(() =>
      searchDocuments("user-1", ['"', "NEAR(", "*"], relevance),
    ).not.toThrow();
  });

  it("returns nothing for empty terms", () => {
    upsertDocuments([doc({ articleId: 1, body: "anything" })]);

    expect(searchDocuments("user-1", ["  "], relevance)).toEqual([]);
  });

  it("ranks articles matching more terms, and title matches, higher", () => {
    upsertDocuments([
      doc({ articleId: 1, body: "Google mentioned in passing." }),
      doc({
        articleId: 2,
        title: "Alphabet shares climb",
        body: "Google parent, GOOGL up.",
      }),
    ]);

    const hits = searchDocuments(
      "user-1",
      ["Alphabet", "Google", "GOOGL"],
      relevance,
    );

    expect(hits.map((hit) => hit.articleId)).toEqual([2, 1]);
  });

  it("only returns the given user's articles", () => {
    upsertDocuments([
      doc({ articleId: 1, userId: "user-1", body: "Alphabet" }),
      doc({ articleId: 2, userId: "user-2", body: "Alphabet" }),
    ]);

    const hits = searchDocuments("user-1", ["Alphabet"], relevance);

    expect(hits.map((hit) => hit.articleId)).toEqual([1]);
  });

  it("filters by inclusive date range", () => {
    upsertDocuments([
      doc({
        articleId: 1,
        body: "x",
        published: new Date("2025-12-31T23:00:00Z"),
      }),
      doc({
        articleId: 2,
        body: "x",
        published: new Date("2026-01-01T00:00:00Z"),
      }),
      doc({
        articleId: 3,
        body: "x",
        published: new Date("2026-03-31T22:00:00Z"),
      }),
      doc({
        articleId: 4,
        body: "x",
        published: new Date("2026-04-01T00:00:00Z"),
      }),
    ]);

    const hits = searchDocuments("user-1", ["x"], {
      ...relevance,
      sort: "oldest",
      from: "2026-01-01",
      to: "2026-03-31",
    });

    expect(hits.map((hit) => hit.articleId)).toEqual([2, 3]);
  });

  it("sorts by newest and oldest and applies the limit", () => {
    upsertDocuments([
      doc({
        articleId: 1,
        body: "x",
        published: new Date("2026-01-01T00:00:00Z"),
      }),
      doc({
        articleId: 2,
        body: "x",
        published: new Date("2026-03-01T00:00:00Z"),
      }),
      doc({
        articleId: 3,
        body: "x",
        published: new Date("2026-02-01T00:00:00Z"),
      }),
    ]);

    const ids = (sort: "newest" | "oldest", limit: number) =>
      searchDocuments("user-1", ["x"], { sort, limit }).map(
        (hit) => hit.articleId,
      );

    expect(ids("newest", 10)).toEqual([2, 3, 1]);
    expect(ids("oldest", 2)).toEqual([1, 3]);
  });

  it("breaks date ties by article id", () => {
    const published = new Date("2026-02-01T00:00:00Z");
    upsertDocuments([
      doc({ articleId: 5, body: "x", published }),
      doc({ articleId: 3, body: "x", published }),
      doc({ articleId: 4, body: "x", published }),
    ]);

    const ids = (sort: "newest" | "oldest") =>
      searchDocuments("user-1", ["x"], { sort, limit: 10 }).map(
        (hit) => hit.articleId,
      );

    expect(ids("oldest")).toEqual([3, 4, 5]);
    expect(ids("newest")).toEqual([5, 4, 3]);
  });
});

describe("upsertDocuments / deleteDocuments / indexedArticleIds", () => {
  it("replaces a document with the same article id", () => {
    upsertDocuments([doc({ articleId: 1, body: "old words" })]);
    upsertDocuments([doc({ articleId: 1, body: "new words" })]);

    expect(indexedArticleIds()).toEqual([1]);
    expect(searchDocuments("user-1", ["old"], relevance)).toEqual([]);
    expect(searchDocuments("user-1", ["new"], relevance)).toHaveLength(1);
  });

  it("deletes documents by article id", () => {
    upsertDocuments([doc({ articleId: 1 }), doc({ articleId: 2 })]);

    deleteDocuments([1]);

    expect(indexedArticleIds()).toEqual([2]);
  });
});

describe("recovery", () => {
  it("recreates an index file that is not a database", () => {
    closeSearchIndex();
    const path = searchIndexPath();
    for (const suffix of ["-wal", "-shm"]) {
      rmSync(`${path}${suffix}`, { force: true });
    }
    writeFileSync(path, "this is not a database, just junk bytes ".repeat(50));

    upsertDocuments([doc({ articleId: 7, body: "fresh" })]);

    expect(indexedArticleIds()).toEqual([7]);
  });

  it("shares one connection between module graphs, so a recreated file is used by all", async () => {
    upsertDocuments([doc({ articleId: 1 })]);
    // Next loads instrumentation and request handlers as separate graphs.
    vi.resetModules();
    const otherGraph = await import("@/lib/search/searchIndex");

    // What recovery does in the other graph: close, then delete the file.
    otherGraph.closeSearchIndex();
    const path = searchIndexPath();
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(`${path}${suffix}`, { force: true });
    }
    upsertDocuments([doc({ articleId: 2 })]);

    expect(otherGraph.indexedArticleIds()).toEqual([2]);
  });
});
