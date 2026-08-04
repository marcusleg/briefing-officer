import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve(
    __dirname,
    "../../src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx",
  ),
  "utf8",
);

describe("Audio summary page layout", () => {
  it("aligns the visible Back button content with the article rail", () => {
    expect(pageSource).toContain('<article className="mx-auto flex max-w-4xl');
    expect(pageSource).toContain('<div className="-ml-3 self-start">');
    expect(pageSource).toContain("<BackButton />");
  });

  it("passes the article's own metadata to the player", () => {
    // The opening line is built from these, so they must reach the client.
    expect(pageSource).toContain("<AudioSummaryPlayer");
    expect(pageSource).toContain("feedTitle={article.feed.title}");
    expect(pageSource).toContain("author={article.scrape?.author}");
  });

  it("explains itself when the article body could not be retrieved", () => {
    expect(pageSource).toContain("Audio summary unavailable");
  });
});
