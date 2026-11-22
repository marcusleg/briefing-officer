import {
  articleIdFromPath,
  articlePath,
  citedArticleIds,
} from "@/lib/ai/chat/articlePath";
import { describe, expect, it } from "vitest";

describe("articleIdFromPath", () => {
  it("reads the article id back from an article path", () => {
    expect(articleIdFromPath(articlePath({ id: 42, feedId: 7 }))).toBe(42);
  });

  it("allows a trailing slash, query or fragment", () => {
    expect(articleIdFromPath("/feed/7/article/42/text-summary/")).toBe(42);
    expect(articleIdFromPath("/feed/7/article/42/text-summary?x=1")).toBe(42);
    expect(articleIdFromPath("/feed/7/article/42/text-summary#top")).toBe(42);
  });

  it("ignores an id no article can have", () => {
    expect(
      articleIdFromPath("/feed/7/article/99999999999999999999999/text-summary"),
    ).toBeUndefined();
  });

  it("ignores anything that is not an article path", () => {
    expect(articleIdFromPath("/feed/7")).toBeUndefined();
    expect(
      articleIdFromPath("/feed/7/article/42/text-summary-old"),
    ).toBeUndefined();
    expect(
      articleIdFromPath("https://evil.example/feed/7/article/42/text-summary"),
    ).toBeUndefined();
    expect(articleIdFromPath("#fn-1")).toBeUndefined();
  });
});

describe("citedArticleIds", () => {
  it("finds every article an answer cites, once each", () => {
    const text = [
      "Alphabet beat estimates ([report](/feed/1/article/2/text-summary)).",
      "Meta fell ([Meta](/feed/3/article/4/text-summary)).",
      "Again: [report](/feed/1/article/2/text-summary).",
      "Elsewhere: [site](https://news.example/a).",
    ].join("\n");

    expect(citedArticleIds(text)).toEqual([2, 4]);
  });

  it("leaves out ids no article can have", () => {
    const text =
      "[a](/feed/1/article/2/text-summary) [b](/feed/1/article/99999999999999999999999/text-summary)";

    expect(citedArticleIds(text)).toEqual([2]);
  });
});
