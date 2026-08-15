import {
  DEFAULT_DISINTERESTS,
  dedupeKeywords,
  describeFilters,
  sortKeywords,
} from "@/lib/feedFilters";
import { describe, expect, it } from "vitest";

describe("describeFilters", () => {
  it("reports that nothing is filtered when both lists are empty", () => {
    expect(describeFilters([], [])).toBe(
      "No filtering — every article from this feed is kept.",
    );
  });

  it("reads as an exclusion list when only disinterests are set", () => {
    expect(describeFilters([], ["advertisements", "sponsored posts"])).toBe(
      "Everything except advertisements, sponsored posts.",
    );
  });

  it("reads as a whitelist when only interests are set", () => {
    expect(describeFilters(["Linux Kernel Development"], [])).toBe(
      "Only Linux Kernel Development.",
    );
  });

  it("reads as a whitelist with carve-outs when both are set", () => {
    expect(
      describeFilters(["Linux Kernel Development"], ["USB driver development"]),
    ).toBe("Only Linux Kernel Development, except USB driver development.");
  });
});

describe("dedupeKeywords", () => {
  it("trims entries and drops empty ones", () => {
    expect(dedupeKeywords(["  spaced  ", "", "   "])).toEqual(["spaced"]);
  });

  it("removes case-insensitive duplicates, keeping the first spelling", () => {
    expect(dedupeKeywords(["Crypto", "crypto", "CRYPTO"])).toEqual(["Crypto"]);
  });

  it("preserves the order entries were given in", () => {
    expect(dedupeKeywords(["b", "a", "b"])).toEqual(["b", "a"]);
  });
});

describe("sortKeywords", () => {
  it("orders entries alphabetically", () => {
    expect(sortKeywords(["kernel", "USB", "advertisements"])).toEqual([
      "advertisements",
      "kernel",
      "USB",
    ]);
  });

  it("sorts case-insensitively, so an uppercase entry doesn't jump to the front", () => {
    expect(sortKeywords(["Zebra", "apple"])).toEqual(["apple", "Zebra"]);
  });

  it("does not mutate the input array", () => {
    const entries = ["b", "a"];

    const sorted = sortKeywords(entries);

    expect(entries).toEqual(["b", "a"]);
    expect(sorted).toEqual(["a", "b"]);
  });
});

describe("DEFAULT_DISINTERESTS", () => {
  it("is advertisements and sponsored posts, in that order", () => {
    expect([...DEFAULT_DISINTERESTS]).toEqual([
      "advertisements",
      "sponsored posts",
    ]);
  });
});
