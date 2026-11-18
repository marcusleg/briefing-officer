import prisma from "@/lib/prismaClient";
import { indexArticle, syncSearchIndex } from "@/lib/search/articleIndexing";
import {
  indexedArticleIds,
  searchDocuments,
  upsertDocuments,
} from "@/lib/search/searchIndex";
import { beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

const find = (terms: string[]) =>
  searchDocuments(userId, terms, { sort: "relevance", limit: 10 }).map(
    (hit) => hit.articleId,
  );

describe("indexArticle", () => {
  it("indexes title, lead and scraped text", async () => {
    const article = await createArticle({ userId, feedId, title: "Quarterly" });
    await prisma.articleLead.create({
      data: { articleId: article.id, text: "Alphabet beat estimates." },
    });
    await prisma.articleScrape.create({
      data: { articleId: article.id, textContent: "GOOGL rose.", author: "" },
    });

    await indexArticle(article.id);

    expect(find(["Quarterly"])).toEqual([article.id]);
    expect(find(["Alphabet"])).toEqual([article.id]);
    expect(find(["GOOGL"])).toEqual([article.id]);
  });

  it("falls back to the RSS description without a scrape", async () => {
    const article = await createArticle({ userId, feedId });
    await prisma.article.update({
      where: { id: article.id },
      data: { description: "Teaser about tariffs" },
    });

    await indexArticle(article.id);

    expect(find(["tariffs"])).toEqual([article.id]);
  });

  it("does nothing for an article that no longer exists", async () => {
    await indexArticle(999_999);

    expect(indexedArticleIds()).toEqual([]);
  });
});

describe("syncSearchIndex", () => {
  it("indexes missing articles and removes rows for deleted ones", async () => {
    const kept = await createArticle({ userId, feedId, title: "Kept" });
    const missing = await createArticle({ userId, feedId, title: "Missing" });
    await indexArticle(kept.id);
    upsertDocuments([
      {
        articleId: 424_242,
        userId,
        title: "Deleted",
        lead: "",
        body: "",
        published: new Date(),
      },
    ]);

    const result = await syncSearchIndex();

    expect(result).toEqual({ added: 1, removed: 1 });
    expect(indexedArticleIds()).toEqual(
      [kept.id, missing.id].sort((a, b) => a - b),
    );
  });

  it("reports nothing to do when the index is current", async () => {
    const article = await createArticle({ userId, feedId });
    await indexArticle(article.id);

    expect(await syncSearchIndex()).toEqual({ added: 0, removed: 0 });
  });
});
