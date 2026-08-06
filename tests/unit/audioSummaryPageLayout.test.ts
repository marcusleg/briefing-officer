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

  it("passes the article's language and title to the player", () => {
    // Language picks the voice; the title is spoken from code so playback can
    // start before the model returns anything. The author and publication do
    // not travel to the client — the server action loads those itself for the
    // generated part of the introduction.
    expect(pageSource).toContain("<AudioSummaryPlayer");
    expect(pageSource).toContain("language={article.language}");
    expect(pageSource).toContain("title={article.title}");
    expect(pageSource).not.toContain("feedTitle={article.feed.title}");
  });

  it("explains itself when the article body could not be retrieved", () => {
    expect(pageSource).toContain("Audio summary unavailable");
  });
});
