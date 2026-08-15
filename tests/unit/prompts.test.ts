import {
  buildAudioScriptPrompt,
  buildLeadPrompt,
  buildSummaryPrompt,
} from "@/lib/ai/prompts";
import { describe, expect, it } from "vitest";

describe("buildLeadPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here", [], []);
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("no longer than 80 words");
  });

  it("asks the model to report the language as an ISO 639-1 code", () => {
    // The lead is the one call that determines the language; everything
    // downstream reads what it stored.
    const prompt = buildLeadPrompt("My Title", "Body text here", [], []);
    expect(prompt).toContain("ISO 639-1");
    expect(prompt).toContain('"und"');
  });

  it("asks for the lead in the language it reports", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here", [], []);
    expect(prompt).toContain("in the language you reported");
  });

  it("leaves the lead prompt unchanged when both lists are empty", () => {
    const prompt = buildLeadPrompt("Title", "Body", [], []);

    expect(prompt).not.toContain("reader_interests");
    expect(prompt).not.toContain("reader_disinterests");
    expect(prompt).not.toContain("excludeArticle");
    expect(prompt).toContain("no longer than 80 words");
  });

  it("renders only the list that has entries", () => {
    const prompt = buildLeadPrompt("Title", "Body", [], ["press releases"]);

    expect(prompt).toContain("<reader_disinterests>");
    expect(prompt).toContain("- press releases");
    expect(prompt).not.toContain("<reader_interests>");
  });

  it("renders both lists when both have entries", () => {
    const prompt = buildLeadPrompt(
      "Title",
      "Body",
      ["Linux kernel development"],
      ["USB driver development"],
    );

    expect(prompt).toContain("- Linux kernel development");
    expect(prompt).toContain("- USB driver development");
    expect(prompt).toContain("excludeArticle");
  });

  // Specificity, not list precedence, is what settles a conflict. Both of the
  // examples that motivated the rule pull in opposite directions under any
  // fixed precedence, so this instruction is the whole design in one sentence
  // and a reword must not lose it.
  it("tells the model that the narrower entry wins, whichever list it is in", () => {
    const prompt = buildLeadPrompt(
      "Title",
      "Body",
      ["politics"],
      ["sport"],
    ).replace(/\s+/g, " ");

    expect(prompt).toContain(
      "the narrower entry decides — whichever list it is in",
    );
  });

  it("keeps an unmatched article when the interest list is empty", () => {
    const prompt = buildLeadPrompt("Title", "Body", [], ["sport"]).replace(
      /\s+/g,
      " ",
    );

    expect(prompt).toContain("If neither list speaks to this article, keep it");
    expect(prompt).not.toContain(
      "exclude it — the reader named what they want",
    );
  });

  it("excludes an unmatched article when the interest list is not empty", () => {
    const prompt = buildLeadPrompt("Title", "Body", ["kernel"], []).replace(
      /\s+/g,
      " ",
    );

    expect(prompt).toContain(
      "If neither list speaks to this article, exclude it",
    );
    expect(prompt).not.toContain(
      "If neither list speaks to this article, keep it",
    );
  });
});

describe("buildSummaryPrompt", () => {
  it("includes the article text and Markdown structure cues", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here", null);
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("Key Facts");
    expect(prompt).toContain("Key Takeaways");
  });

  it("names the article's language", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here", "de");
    expect(prompt).toContain("Write entirely in German.");
  });

  it("falls back to English when no language was established", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here", null);
    expect(prompt).toContain("Write entirely in English.");
  });

  it("asks for the heading to be translated too", () => {
    // The heading names are given in English as selection criteria, so
    // without this a German summary gets German bullets under an English
    // heading.
    const prompt = buildSummaryPrompt("My Title", "Body text here", "de");
    expect(prompt).toContain("translate the one you choose");
  });
});

describe("buildAudioScriptPrompt", () => {
  const args = {
    title: "My Title",
    author: "Jane Doe",
    feedTitle: "Hacker News",
    textContent: "Body text here",
    language: null as string | null,
  };

  it("includes the title, the article text, and the publication", () => {
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("Hacker News");
  });

  it("asks for spoken prose of about one minute", () => {
    expect(buildAudioScriptPrompt(args)).toContain("150 to 200 words");
  });

  it("forbids Markdown, since the output is spoken rather than rendered", () => {
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("plain text only");
  });

  it("supplies the author when one is known", () => {
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("<author>Jane Doe</author>");
    expect(prompt).toContain("naming the publication and the author");
  });

  it("omits the author entirely when none is known", () => {
    // Structural guard: with no author element in the prompt there is nothing
    // for the model to invent one from.
    const prompt = buildAudioScriptPrompt({ ...args, author: null });
    expect(prompt).not.toContain("<author>");
    expect(prompt).toContain("do not mention one");
  });

  it("asks for one sentence per line", () => {
    // Playback splits the stream on newlines, so this instruction is what
    // makes sentence boundaries work in every language.
    expect(buildAudioScriptPrompt(args)).toContain("own line");
  });

  it("names the article's language", () => {
    const prompt = buildAudioScriptPrompt({ ...args, language: "de" });
    expect(prompt).toContain("Write entirely in German.");
  });

  it("falls back to English when no language was established", () => {
    expect(buildAudioScriptPrompt(args)).toContain(
      "Write entirely in English.",
    );
  });
});
