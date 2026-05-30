import { categorySchema, feedSchema } from "@/lib/repository/feedSchema";
import { describe, expect, it } from "vitest";

const validFeed = {
  title: "Example",
  link: "https://example.com/feed.xml",
  titleFilterExpressions: "",
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

  it("rejects an invalid regex in titleFilterExpressions", () => {
    const result = feedSchema.safeParse({
      ...validFeed,
      titleFilterExpressions: "[unclosed",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a multi-line titleFilterExpressions where all lines are valid", () => {
    const result = feedSchema.safeParse({
      ...validFeed,
      titleFilterExpressions: "sport\n^Ad:\nbreaking",
    });
    expect(result.success).toBe(true);
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
