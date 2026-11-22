import { isArticleId, MAX_ARTICLE_ID } from "@/lib/articleId";
import { describe, expect, it } from "vitest";

describe("isArticleId", () => {
  it("accepts positive whole numbers the database can store", () => {
    expect(isArticleId(1)).toBe(true);
    expect(isArticleId(MAX_ARTICLE_ID)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [
      0,
      -1,
      1.5,
      MAX_ARTICLE_ID + 1,
      1e23,
      NaN,
      "7",
      null,
    ]) {
      expect(isArticleId(value)).toBe(false);
    }
  });
});
