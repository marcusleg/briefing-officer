import { MAX_SENTENCE_LENGTH, spokenSentences } from "@/lib/chat-speech-text";
import { describe, expect, it } from "vitest";

describe("spokenSentences", () => {
  it("splits a paragraph into sentences", () => {
    expect(
      spokenSentences("Alphabet rose 4%. Analysts expected less."),
    ).toEqual(["Alphabet rose 4%.", "Analysts expected less."]);
  });

  it("keeps headings and list items without periods as their own sentences", () => {
    expect(
      spokenSentences("## Results\n\n- Revenue grew\n- Costs fell"),
    ).toEqual(["Results", "Revenue grew", "Costs fell"]);
  });

  it("reads links as their text, never their URL", () => {
    expect(
      spokenSentences(
        "[Alphabet beats estimates](/feed/1/article/2/text-summary) reported growth.",
      ),
    ).toEqual(["Alphabet beats estimates reported growth."]);
  });

  it("reads emphasis and inline code as plain text", () => {
    expect(spokenSentences("It is **very** _fast_ and uses `gpt`.")).toEqual([
      "It is very fast and uses gpt.",
    ]);
  });

  it("skips code blocks, images, HTML and math", () => {
    expect(
      spokenSentences(
        [
          "Before.",
          "```js\nconst x = 1;\n```",
          "See ![chart](https://evil.example/x.png) this.",
          "<div>hidden</div>",
          "The ratio $$x^2$$ grew.",
          "$$\nx = 1\n$$",
          "After.",
        ].join("\n\n"),
      ),
    ).toEqual(["Before.", "See this.", "The ratio grew.", "After."]);
  });

  it("reads dollar amounts", () => {
    expect(
      spokenSentences("Revenue rose from $5 billion to $7 billion last year."),
    ).toEqual(["Revenue rose from $5 billion to $7 billion last year."]);
  });

  it("reads blockquote paragraphs", () => {
    expect(spokenSentences("> Growth was strong.\n>\n> Costs fell.")).toEqual([
      "Growth was strong.",
      "Costs fell.",
    ]);
  });

  it("reads nested list items as their own sentences", () => {
    expect(spokenSentences("- Revenue\n  - Cloud grew\n  - Ads fell")).toEqual([
      "Revenue",
      "Cloud grew",
      "Ads fell",
    ]);
  });

  it("skips footnote references and definitions", () => {
    expect(
      spokenSentences("Growth was strong.[^1]\n\n[^1]: Source article."),
    ).toEqual(["Growth was strong."]);
  });

  it("skips list items that are only links", () => {
    expect(
      spokenSentences(
        [
          "Growth was strong.",
          "Sources:",
          "- [Alphabet beats estimates](/feed/1/article/2/text-summary)\n- [Cloud grows](/feed/1/article/3/text-summary).",
        ].join("\n\n"),
      ),
    ).toEqual(["Growth was strong.", "Sources:"]);
  });

  it("keeps list items that say more than a link", () => {
    expect(
      spokenSentences("- [Alphabet](/feed/1/article/2/text-summary) grew"),
    ).toEqual(["Alphabet grew"]);
  });

  it("reads table cells one by one", () => {
    expect(
      spokenSentences(
        "| Company | Change |\n| --- | --- |\n| Alphabet | +4% |",
      ),
    ).toEqual(["Company", "Change", "Alphabet", "+4%"]);
  });

  it("collapses whitespace inside a block", () => {
    expect(spokenSentences("One\nline   continues.")).toEqual([
      "One line continues.",
    ]);
  });

  it("splits a sentence over the limit at whitespace", () => {
    const sentence = "word ".repeat(1000).trim();

    const pieces = spokenSentences(sentence);

    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(MAX_SENTENCE_LENGTH);
    }
    expect(pieces.join(" ")).toBe(sentence);
  });

  it("splits a sentence over the limit without whitespace at the limit", () => {
    expect(spokenSentences("a".repeat(5000))).toEqual([
      "a".repeat(MAX_SENTENCE_LENGTH),
      "a".repeat(5000 - MAX_SENTENCE_LENGTH),
    ]);
  });

  it("returns nothing when there is nothing to read", () => {
    expect(spokenSentences("")).toEqual([]);
    expect(spokenSentences("```\ncode\n```")).toEqual([]);
  });
});
