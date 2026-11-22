import { getArticlesForStatusChange } from "@/lib/repository/chatRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  feedId = (await createFeed({ userId, title: "Markets Daily" })).id;
});

describe("getArticlesForStatusChange", () => {
  it("returns the reader's articles in the order asked, with feed, date and status", async () => {
    const first = await createArticle({
      userId,
      feedId,
      title: "First",
      publicationDate: new Date("2026-04-25T09:00:00Z"),
      status: "READ",
    });
    const second = await createArticle({ userId, feedId, title: "Second" });

    const result = await getArticlesForStatusChange([second.id, first.id]);

    expect(result.notFound).toBe(0);
    expect(result.articles.map((a) => a.title)).toEqual(["Second", "First"]);
    expect(result.articles[1]).toEqual({
      id: first.id,
      title: "First",
      feed: "Markets Daily",
      published: "2026-04-25",
      status: "READ",
    });
  });

  it("counts another user's and missing articles as not found", async () => {
    const otherUserId = (await createUser()).id;
    const otherFeedId = (await createFeed({ userId: otherUserId })).id;
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
      title: "Secret",
    });

    const result = await getArticlesForStatusChange([foreign.id, 999_999]);

    expect(result).toEqual({ articles: [], notFound: 2 });
  });

  it("ignores duplicates and anything that is not an integer id", async () => {
    const article = await createArticle({ userId, feedId });

    const result = await getArticlesForStatusChange([
      article.id,
      article.id,
      1.5,
      "7" as unknown as number,
    ]);

    expect(result.articles).toHaveLength(1);
    expect(result.notFound).toBe(0);
  });

  it("looks at no more than 50 ids", async () => {
    const ids = Array.from({ length: 60 }, (_, index) => 900_000 + index);

    const result = await getArticlesForStatusChange(ids);

    expect(result.notFound).toBe(50);
  });
});
