import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve(
    __dirname,
    "../../src/app/feed/[feedId]/article/[articleId]/ai-summary/page.tsx",
  ),
  "utf8",
);

describe("AI summary page layout", () => {
  it("aligns the visible Back button content with the article rail", () => {
    expect(pageSource).toContain('<article className="mx-auto flex max-w-4xl');
    expect(pageSource).toContain('<div className="-ml-3 self-start">');
    expect(pageSource).toContain("<BackButton />");
  });
});
