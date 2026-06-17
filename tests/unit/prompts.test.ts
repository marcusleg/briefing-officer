import { buildLeadPrompt, buildSummaryPrompt } from "@/lib/ai/prompts";
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
