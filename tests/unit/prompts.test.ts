import {
  buildAudioScriptPrompt,
  buildLeadPrompt,
  buildSummaryPrompt,
} from "@/lib/ai/prompts";
import { describe, expect, it } from "vitest";

describe("buildLeadPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here");
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("no longer than 80 words");
  });
});

describe("buildSummaryPrompt", () => {
  it("includes the article text and Markdown structure cues", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here");
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("Key Facts");
    expect(prompt).toContain("Key Takeaways");
  });
});

describe("buildAudioScriptPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
  });

  it("asks for spoken prose of about one minute", () => {
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("150 to 200 words");
  });

  it("forbids Markdown, since the output is spoken rather than rendered", () => {
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("plain text only");
  });

  it("tells the model the article has already been introduced", () => {
    // The opening line is constructed in code, so the body must not repeat it.
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("already been introduced");
  });
});
