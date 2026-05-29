import { filterFeedItemsByTitle } from "@/lib/repository/feedFilter";
import { describe, expect, it } from "vitest";

const items = [
  { title: "Breaking news", link: "a" },
  { title: "Sports roundup", link: "b" },
  { title: "Weather today", link: "c" },
];

describe("filterFeedItemsByTitle", () => {
  it("returns all items when there are no expressions", () => {
    expect(filterFeedItemsByTitle(items, "")).toEqual(items);
  });

  it("removes items whose title matches an expression", () => {
    const result = filterFeedItemsByTitle(items, "Sports");
    expect(result.map((i) => i.link)).toEqual(["a", "c"]);
  });

  it("ignores blank lines between expressions", () => {
    const result = filterFeedItemsByTitle(items, "Sports\n\nWeather");
    expect(result.map((i) => i.link)).toEqual(["a"]);
  });

  it("ignores an invalid regex line and keeps filtering with valid ones", () => {
    const result = filterFeedItemsByTitle(items, "[unclosed\nWeather");
    expect(result.map((i) => i.link)).toEqual(["a", "b"]);
  });
});
