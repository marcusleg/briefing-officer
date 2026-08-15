import { categorySchema, feedSchema } from "@/lib/repository/feedSchema";
import { describe, expect, it } from "vitest";

const validFeed = {
  title: "Example",
  link: "https://example.com/feed.xml",
  autoRefresh: true,
};

describe("feedSchema", () => {
  it("accepts a valid feed", () => {
    expect(feedSchema.safeParse(validFeed).success).toBe(true);
  });

  it("rejects an invalid link URL", () => {
    const result = feedSchema.safeParse({ ...validFeed, link: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("feedSchema keyword lists", () => {
  const base = {
    title: "T",
    link: "https://example.com/feed.xml",
    autoRefresh: true,
  };

  it("defaults both lists to empty", () => {
    const parsed = feedSchema.parse(base);

    expect(parsed.interests).toEqual([]);
    expect(parsed.disinterests).toEqual([]);
  });

  it("trims entries", () => {
    const parsed = feedSchema.parse({ ...base, interests: ["  kernel  "] });

    expect(parsed.interests).toEqual(["kernel"]);
  });

  it("rejects an entry that is empty once trimmed", () => {
    expect(() => feedSchema.parse({ ...base, interests: ["   "] })).toThrow();
  });

  it("keeps entries containing spaces intact", () => {
    const parsed = feedSchema.parse({
      ...base,
      disinterests: ["long form opinion pieces about football"],
    });

    expect(parsed.disinterests).toEqual([
      "long form opinion pieces about football",
    ]);
  });
});

describe("categorySchema", () => {
  it("rejects an empty name", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    expect(categorySchema.safeParse({ name: "a".repeat(101) }).success).toBe(
      false,
    );
  });

  it("accepts a valid name", () => {
    expect(categorySchema.safeParse({ name: "News" }).success).toBe(true);
  });
});
