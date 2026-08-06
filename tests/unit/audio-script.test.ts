import { splitIntoSentences, spokenTitle } from "@/lib/audio-script";
import { describe, expect, it } from "vitest";

describe("spokenTitle", () => {
  it("terminates a headline so it does not run into the next sentence", () => {
    expect(spokenTitle("Kernel 7.2 removes strncpy")).toBe(
      "Kernel 7.2 removes strncpy.",
    );
  });

  it("keeps a headline's own terminal punctuation", () => {
    // Headlines frequently end in "?" or "!", and replacing those with a
    // period changes how the voice reads the line.
    expect(spokenTitle("Is Rust dead?")).toBe("Is Rust dead?");
    expect(spokenTitle("It shipped!")).toBe("It shipped!");
    expect(spokenTitle("It shipped.")).toBe("It shipped.");
  });

  it("trims surrounding whitespace", () => {
    expect(spokenTitle("  Kernel 7.2 removes strncpy  ")).toBe(
      "Kernel 7.2 removes strncpy.",
    );
  });
});

describe("splitIntoSentences", () => {
  it("returns complete lines and keeps the unterminated tail", () => {
    expect(
      splitIntoSentences("Linux 7.2 drops strncpy.\nIt landed Fri"),
    ).toEqual({
      sentences: ["Linux 7.2 drops strncpy."],
      remainder: "It landed Fri",
    });
  });

  it("finds several sentences in one buffer", () => {
    expect(splitIntoSentences("One.\nTwo.\nThree")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("holds everything back until a newline arrives", () => {
    expect(splitIntoSentences("It cost 3.")).toEqual({
      sentences: [],
      remainder: "It cost 3.",
    });
  });

  it("does not split on punctuation inside a line", () => {
    // The whole point of delimiting on newlines: no abbreviation list, so
    // "z.B." and "Dr." are equally safe in any language.
    expect(
      splitIntoSentences("Laut Dr. Schmidt, z.B. in Berlin, gilt das.\nDann"),
    ).toEqual({
      sentences: ["Laut Dr. Schmidt, z.B. in Berlin, gilt das."],
      remainder: "Dann",
    });
  });

  it("keeps a sentence whole across an abbreviation no English list knew", () => {
    // The discriminating case for the rewrite: the old punctuation splitter
    // fragmented this at "usw." because that abbreviation was absent from its
    // English list. Newline delimiting has no such list to be absent from.
    expect(splitIntoSentences("Vorher usw. Nachher.\nDanach")).toEqual({
      sentences: ["Vorher usw. Nachher."],
      remainder: "Danach",
    });
  });

  it("ignores blank lines", () => {
    expect(splitIntoSentences("One.\n\nTwo.\nThree")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("trims surrounding whitespace from each sentence", () => {
    expect(splitIntoSentences("  One.  \n Two. \nThree")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("returns nothing for empty input", () => {
    expect(splitIntoSentences("")).toEqual({ sentences: [], remainder: "" });
  });

  it("survives being fed its own remainder with the next delta appended", () => {
    // How the player actually drives it, one streamed chunk at a time.
    const first = splitIntoSentences("One.\nTwo");
    expect(first.sentences).toEqual(["One."]);

    const second = splitIntoSentences(`${first.remainder} and a half.\nThree`);
    expect(second).toEqual({
      sentences: ["Two and a half."],
      remainder: "Three",
    });
  });
});
