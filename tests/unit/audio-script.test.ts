import { buildOpeningLine, splitIntoSentences } from "@/lib/audio-script";
import { describe, expect, it } from "vitest";

describe("buildOpeningLine", () => {
  it("names the article, its author, and its feed", () => {
    expect(
      buildOpeningLine("Kernel 7.2 removes strncpy", "Jane Doe", "Hacker News"),
    ).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("drops the attribution when the scraper found no byline", () => {
    // scraper.ts stores "" when Readability finds no byline, which is common.
    expect(
      buildOpeningLine("Kernel 7.2 removes strncpy", "", "Hacker News"),
    ).toBe("Kernel 7.2 removes strncpy. From Hacker News.");
  });

  it("drops the attribution when the author is null or undefined", () => {
    expect(buildOpeningLine("A title", null, "Hacker News")).toBe(
      "A title. From Hacker News.",
    );
    expect(buildOpeningLine("A title", undefined, "Hacker News")).toBe(
      "A title. From Hacker News.",
    );
  });

  it("keeps a title's own terminal punctuation instead of adding a period", () => {
    // Headlines ending in "?" or "!" are common; running them into a comma
    // would read as an audible glitch.
    expect(buildOpeningLine("Is Rust dead?", "Jane Doe", "Hacker News")).toBe(
      "Is Rust dead? Written by Jane Doe, from Hacker News.",
    );
    expect(buildOpeningLine("Ship it!", "", "Hacker News")).toBe(
      "Ship it! From Hacker News.",
    );
  });

  it("speaks the author verbatim without tidying the byline", () => {
    // Normalising bylines here would create a second place that knows how to
    // clean them up, making the real fix harder. See the spec's non-goals.
    expect(buildOpeningLine("A title", "By Jane Doe", "Hacker News")).toBe(
      "A title. Written by By Jane Doe, from Hacker News.",
    );
  });
});

describe("splitIntoSentences", () => {
  it("returns complete sentences and keeps the unterminated tail", () => {
    expect(
      splitIntoSentences("Linux 7.2 drops strncpy. It landed Fri"),
    ).toEqual({
      sentences: ["Linux 7.2 drops strncpy."],
      remainder: "It landed Fri",
    });
  });

  it("splits on question and exclamation marks", () => {
    expect(splitIntoSentences("Is Rust dead? No! Not yet")).toEqual({
      sentences: ["Is Rust dead?", "No!"],
      remainder: "Not yet",
    });
  });

  it("does not split inside a decimal number", () => {
    expect(
      splitIntoSentences("Revenue rose 3.5 percent last year. And more"),
    ).toEqual({
      sentences: ["Revenue rose 3.5 percent last year."],
      remainder: "And more",
    });
  });

  it("does not split after a common abbreviation", () => {
    expect(splitIntoSentences("Dr. Smith arrived. Then left")).toEqual({
      sentences: ["Dr. Smith arrived."],
      remainder: "Then left",
    });
  });

  it("does not split inside an acronym with periods", () => {
    expect(splitIntoSentences("The U.S. government agreed. Later on")).toEqual({
      sentences: ["The U.S. government agreed."],
      remainder: "Later on",
    });
  });

  it("treats an ellipsis as a pause, not a sentence end", () => {
    expect(splitIntoSentences("Well... anyway. Next up")).toEqual({
      sentences: ["Well... anyway."],
      remainder: "Next up",
    });
  });

  it("holds back a terminator that no whitespace has confirmed yet", () => {
    // Mid-stream, "3." may still become "3.5", so a terminator only counts
    // once the following character has arrived.
    expect(splitIntoSentences("It cost 3.")).toEqual({
      sentences: [],
      remainder: "It cost 3.",
    });
  });

  it("returns nothing for empty and whitespace-only input", () => {
    expect(splitIntoSentences("")).toEqual({ sentences: [], remainder: "" });
    expect(splitIntoSentences("   ")).toEqual({ sentences: [], remainder: "" });
  });

  it("finds several sentences in one buffer", () => {
    expect(splitIntoSentences("One. Two. Three")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("splits after a standalone No", () => {
    expect(splitIntoSentences("Is it done? No. Not yet")).toEqual({
      sentences: ["Is it done?", "No."],
      remainder: "Not yet",
    });
  });

  it("splits after an ordinal, which only looks like an abbreviation", () => {
    // The letter-run regex yields "st" from "1st", which would otherwise be
    // suppressed as the abbreviation for Saint or Street.
    expect(splitIntoSentences("He came in 1st. Then left")).toEqual({
      sentences: ["He came in 1st."],
      remainder: "Then left",
    });
  });

  it("still does not split after Saint or Street", () => {
    expect(splitIntoSentences("St. Louis grew. Then more")).toEqual({
      sentences: ["St. Louis grew."],
      remainder: "Then more",
    });
  });

  it("splits after a multi-digit ordinal", () => {
    // Guards the digit-lookback arithmetic, which single-digit ordinals alone
    // would not catch if it were ever changed.
    expect(splitIntoSentences("She placed 21st. Then rested")).toEqual({
      sentences: ["She placed 21st."],
      remainder: "Then rested",
    });
  });

  it("keeps a trailing space that separates two words across deltas", () => {
    // The player feeds the remainder back with the next delta appended, so a
    // trailing space dropped here glues two words into one.
    let buffer = "";
    const spoken: string[] = [];
    for (const delta of ["It landed after ", "362 patches. "]) {
      buffer += delta;
      const { sentences, remainder } = splitIntoSentences(buffer);
      buffer = remainder;
      spoken.push(...sentences);
    }
    expect(spoken).toEqual(["It landed after 362 patches."]);
  });
});
