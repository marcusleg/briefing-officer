import { categorySchema, feedSchema } from "@/lib/repository/feedSchema";
import { describe, expect, it } from "vitest";

const validFeed = {
  title: "Example",
  link: "https://example.com/feed.xml",
  interestProfile: "",
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

  it("accepts an interest profile that is not a valid regular expression", () => {
    const result = feedSchema.safeParse({
      ...validFeed,
      interestProfile: "I like databases [and unclosed brackets",
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
