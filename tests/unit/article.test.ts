import { articleAuthor } from "@/lib/article";
import { describe, expect, it } from "vitest";

describe("articleAuthor", () => {
  it("prefers the feed author over the scraped byline", () => {
    expect(
      articleAuthor({ author: "Jane Doe", scrape: { author: "By Someone" } }),
    ).toBe("Jane Doe");
  });

  it("falls back to the scraped byline when the feed has no author", () => {
    expect(
      articleAuthor({ author: null, scrape: { author: "By Someone" } }),
    ).toBe("By Someone");
  });

  it("treats an empty scraped byline as no author", () => {
    expect(articleAuthor({ author: null, scrape: { author: "" } })).toBeNull();
  });

  it("ignores a feed author that is only whitespace", () => {
    expect(
      articleAuthor({ author: "   ", scrape: { author: "By Someone" } }),
    ).toBe("By Someone");
  });

  it("returns null when the article has not been scraped", () => {
    expect(articleAuthor({ author: null, scrape: null })).toBeNull();
  });
});
