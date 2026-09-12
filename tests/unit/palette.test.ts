import {
  buildFeedPalette,
  buildPalette,
  CHART_COLORS,
} from "@/lib/charts/palette";
import { feedKey } from "@/lib/repository/statsTransforms";
import { describe, expect, it } from "vitest";

describe("CHART_COLORS", () => {
  it("exposes the eight CSS chart variables", () => {
    expect(CHART_COLORS).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "var(--chart-6)",
      "var(--chart-7)",
      "var(--chart-8)",
    ]);
  });
});

describe("buildPalette", () => {
  it("returns an empty config for no entries", () => {
    expect(buildPalette([])).toEqual({});
  });

  it("gives each entry its own label and the next color in order", () => {
    const palette = buildPalette([
      { key: "feed:1", label: "Feed A" },
      { key: "feed:2", label: "Feed B" },
      { key: "feed:3", label: "Feed C" },
    ]);

    expect(palette).toEqual({
      "feed:1": { label: "Feed A", color: "var(--chart-1)" },
      "feed:2": { label: "Feed B", color: "var(--chart-2)" },
      "feed:3": { label: "Feed C", color: "var(--chart-3)" },
    });
  });

  it("keeps two entries sharing a label on separate keys and colors", () => {
    const palette = buildPalette([
      { key: "feed:1", label: "News" },
      { key: "feed:2", label: "News" },
    ]);

    expect(Object.keys(palette)).toEqual(["feed:1", "feed:2"]);
    expect(palette["feed:1"].color).not.toBe(palette["feed:2"].color);
  });

  it("wraps around when there are more entries than colors", () => {
    const palette = buildPalette(
      Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, label: `k${i}` })),
    );

    expect(palette.k0.color).toBe("var(--chart-1)");
    expect(palette.k7.color).toBe("var(--chart-8)");
    expect(palette.k8.color).toBe("var(--chart-1)");
    expect(palette.k9.color).toBe("var(--chart-2)");
  });
});

describe("buildFeedPalette", () => {
  const feeds = [
    { id: 4, title: "Feed A" },
    { id: 9, title: "Feed B" },
    { id: 11, title: "Feed C" },
  ];

  it("files every feed under its row key, labelled with its title", () => {
    expect(buildFeedPalette(feeds)).toEqual({
      [feedKey(4)]: { label: "Feed A", color: "var(--chart-1)" },
      [feedKey(9)]: { label: "Feed B", color: "var(--chart-2)" },
      [feedKey(11)]: { label: "Feed C", color: "var(--chart-3)" },
    });
  });

  it("gives a feed the same color whichever chart's series it turns up in", () => {
    const palette = buildFeedPalette(feeds);

    // One chart stacks all three feeds; another has no rows for Feed A at all.
    // Both look the feed up by the same key, so the color cannot drift.
    const everyFeed = [feedKey(4), feedKey(9), feedKey(11)];
    const withoutFeedA = [feedKey(9), feedKey(11)];

    expect(withoutFeedA.map((key) => palette[key].color)).toEqual(
      everyFeed.slice(1).map((key) => palette[key].color),
    );
    expect(palette[feedKey(9)].color).toBe("var(--chart-2)");
  });

  it("keeps two feeds sharing a title apart", () => {
    const palette = buildFeedPalette([
      { id: 1, title: "News" },
      { id: 2, title: "News" },
    ]);

    expect(Object.keys(palette)).toEqual([feedKey(1), feedKey(2)]);
    expect(palette[feedKey(1)].color).not.toBe(palette[feedKey(2)].color);
  });
});
