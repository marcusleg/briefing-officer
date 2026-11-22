import {
  ARTICLE_TEXT_LIMIT,
  changeArticleStatusForUser,
  getArticleForUser,
  searchArticlesForUser,
  type SearchArticlesInput,
} from "@/lib/ai/chat/articleTools";
import prisma from "@/lib/prismaClient";
import { indexArticle } from "@/lib/search/articleIndexing";
import * as searchIndex from "@/lib/search/searchIndex";
import { upsertDocuments } from "@/lib/search/searchIndex";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId, title: "Markets Daily" })).id;
});

const input = (
  overrides: Partial<SearchArticlesInput> = {},
): SearchArticlesInput => ({
  terms: ["Alphabet"],
  sort: "relevance",
  limit: 10,
  ...overrides,
});

const indexed = async (
  overrides: Parameters<typeof createArticle>[0] & { body?: string },
) => {
  const { body = "Alphabet", ...articleOverrides } = overrides;
  const article = await createArticle(articleOverrides);
  await prisma.articleScrape.create({
    data: { articleId: article.id, textContent: body, author: "" },
  });
  await indexArticle(article.id);
  return article;
};

const ids = (output: Awaited<ReturnType<typeof searchArticlesForUser>>) => {
  if ("error" in output) throw new Error(output.error);
  return output.results.map((result) => result.id);
};

describe("searchArticlesForUser", () => {
  it("returns article details, lead, snippet and in-app path", async () => {
    const article = await indexed({
      userId,
      feedId,
      title: "Alphabet beats estimates",
      publicationDate: new Date("2026-04-25T09:00:00Z"),
    });
    await prisma.articleLead.create({
      data: { articleId: article.id, text: "Revenue rose 12%." },
    });

    const output = await searchArticlesForUser(userId, input());

    expect(output).toEqual({
      results: [
        {
          id: article.id,
          title: "Alphabet beats estimates",
          feed: "Markets Daily",
          published: "2026-04-25",
          status: "UNREAD",
          archived: false,
          lead: "Revenue rose 12%.",
          snippet: expect.any(String),
          path: `/feed/${feedId}/article/${article.id}/text-summary`,
        },
      ],
    });
  });

  it("drops hits whose article belongs to someone else or no longer exists", async () => {
    const otherUserId = (await createUser()).id;
    const otherFeedId = (await createFeed({ userId: otherUserId })).id;
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
    });
    const published = new Date();
    // Index rows that claim to be this user's, to prove Prisma re-checks.
    upsertDocuments([
      {
        articleId: foreign.id,
        userId,
        title: "Alphabet",
        lead: "",
        body: "",
        published,
      },
      {
        articleId: 987_654,
        userId,
        title: "Alphabet",
        lead: "",
        body: "",
        published,
      },
    ]);
    const own = await indexed({ userId, feedId });

    expect(ids(await searchArticlesForUser(userId, input()))).toEqual([own.id]);
  });

  it("filters by status and archived, then applies the limit", async () => {
    const unreadOld = await indexed({
      userId,
      feedId,
      publicationDate: new Date("2026-01-01T00:00:00Z"),
    });
    for (const day of ["02", "03", "04"]) {
      await indexed({
        userId,
        feedId,
        status: "DISMISSED",
        publicationDate: new Date(`2026-01-${day}T00:00:00Z`),
      });
    }
    const archived = await indexed({ userId, feedId, archived: true });

    expect(
      ids(
        await searchArticlesForUser(
          userId,
          input({
            status: "UNREAD",
            sort: "newest",
            limit: 1,
            archived: false,
          }),
        ),
      ),
    ).toEqual([unreadOld.id]);
    expect(
      ids(await searchArticlesForUser(userId, input({ archived: true }))),
    ).toEqual([archived.id]);
  });

  it("finds a rare status even when it ranks far down the candidates", async () => {
    for (let day = 2; day <= 31; day++) {
      await indexed({
        userId,
        feedId,
        publicationDate: new Date(
          `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
        ),
      });
    }
    const readOld = await indexed({
      userId,
      feedId,
      status: "DISMISSED",
      publicationDate: new Date("2026-01-01T00:00:00Z"),
    });

    expect(
      ids(
        await searchArticlesForUser(
          userId,
          input({ status: "DISMISSED", sort: "newest", limit: 1 }),
        ),
      ),
    ).toEqual([readOld.id]);
  });

  it("returns an empty list when nothing matches", async () => {
    await indexed({ userId, feedId });

    expect(
      await searchArticlesForUser(userId, input({ terms: ["Zeppelin"] })),
    ).toEqual({ results: [] });
  });
});

describe("searchArticlesForUser when the index fails", () => {
  it("returns an error the model can relay instead of throwing", async () => {
    vi.spyOn(searchIndex, "searchDocuments").mockImplementationOnce(() => {
      throw new Error("disk I/O error");
    });

    expect(await searchArticlesForUser(userId, input())).toEqual({
      error: "Search is unavailable right now.",
    });
  });
});

describe("getArticleForUser", () => {
  it("returns the full text with the original link", async () => {
    const article = await indexed({ userId, feedId, body: "Full text." });

    const output = await getArticleForUser(userId, article.id);

    expect(output).toMatchObject({
      id: article.id,
      link: article.link,
      text: "Full text.",
      truncated: false,
      path: `/feed/${feedId}/article/${article.id}/text-summary`,
    });
  });

  it("cuts very long text and says so", async () => {
    const article = await indexed({
      userId,
      feedId,
      body: "a".repeat(ARTICLE_TEXT_LIMIT + 10),
    });

    const output = await getArticleForUser(userId, article.id);

    if ("error" in output) throw new Error(output.error);
    expect(output.text).toHaveLength(ARTICLE_TEXT_LIMIT);
    expect(output.truncated).toBe(true);
  });

  it("treats another user's article like a missing one", async () => {
    const otherUserId = (await createUser()).id;
    const otherFeedId = (await createFeed({ userId: otherUserId })).id;
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
    });

    expect(await getArticleForUser(userId, foreign.id)).toEqual({
      error: "not found",
    });
    expect(await getArticleForUser(userId, 987_654)).toEqual({
      error: "not found",
    });
  });
});

describe("changeArticleStatusForUser", () => {
  const longAgo = new Date("2020-01-01T00:00:00Z");
  const reload = (id: number) =>
    prisma.article.findUniqueOrThrow({ where: { id } });

  it.each([
    ["DISMISSED", "UNREAD"],
    ["UNREAD", "READ_LATER"],
    ["READ_LATER", "DISMISSED"],
    ["UNREAD", "FILTERED"],
  ] as const)("sets %s on a %s article", async (target, from) => {
    const article = await createArticle({
      userId,
      feedId,
      status: from,
      statusChangedAt: longAgo,
    });

    const output = await changeArticleStatusForUser(userId, {
      ids: [article.id],
      status: target,
    });

    expect(output).toEqual({
      status: target,
      changed: 1,
      alreadyInStatus: 0,
      notFound: 0,
    });
    const updated = await reload(article.id);
    expect(updated.status).toBe(target);
    expect(updated.statusChangedAt.getTime()).toBeGreaterThan(
      longAgo.getTime(),
    );
  });

  it("counts another user's article as not found and leaves it alone", async () => {
    const otherUserId = (await createUser()).id;
    const otherFeedId = (await createFeed({ userId: otherUserId })).id;
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
    });

    const output = await changeArticleStatusForUser(userId, {
      ids: [foreign.id],
      status: "DISMISSED",
    });

    expect(output).toEqual({
      status: "DISMISSED",
      changed: 0,
      alreadyInStatus: 0,
      notFound: 1,
    });
    expect((await reload(foreign.id)).status).toBe("UNREAD");
  });

  it("skips articles already in the target status so their status time stays", async () => {
    const dismissed = await createArticle({
      userId,
      feedId,
      status: "DISMISSED",
      statusChangedAt: longAgo,
    });
    const unread = await createArticle({ userId, feedId });

    const output = await changeArticleStatusForUser(userId, {
      ids: [dismissed.id, unread.id],
      status: "DISMISSED",
    });

    expect(output).toEqual({
      status: "DISMISSED",
      changed: 1,
      alreadyInStatus: 1,
      notFound: 0,
    });
    expect((await reload(dismissed.id)).statusChangedAt).toEqual(longAgo);
  });

  it("counts deleted ids as not found and duplicates once", async () => {
    const article = await createArticle({ userId, feedId });

    const output = await changeArticleStatusForUser(userId, {
      ids: [article.id, article.id, 999_999],
      status: "DISMISSED",
    });

    expect(output).toEqual({
      status: "DISMISSED",
      changed: 1,
      alreadyInStatus: 0,
      notFound: 1,
    });
  });

  it("returns an error instead of throwing when the update fails", async () => {
    const article = await createArticle({ userId, feedId });
    vi.spyOn(prisma.article, "findMany").mockRejectedValueOnce(
      new Error("database is locked"),
    );

    const output = await changeArticleStatusForUser(userId, {
      ids: [article.id],
      status: "DISMISSED",
    });

    expect(output).toEqual({ error: "update failed" });
    expect((await reload(article.id)).status).toBe("UNREAD");
  });
});
