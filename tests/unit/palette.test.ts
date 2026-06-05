import { buildPalette, CHART_COLORS } from "@/lib/charts/palette";
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
  it("returns an empty config for no keys", () => {
    expect(buildPalette([])).toEqual({});
  });

  it("assigns each key a label and a color from CHART_COLORS in order", () => {
    const palette = buildPalette(["a", "b", "c"]);
    expect(palette).toEqual({
      a: { label: "a", color: "var(--chart-1)" },
      b: { label: "b", color: "var(--chart-2)" },
      c: { label: "c", color: "var(--chart-3)" },
    });
  });

  it("wraps around when there are more keys than colors", () => {
    const keys = Array.from({ length: 10 }, (_, i) => `k${i}`);
    const palette = buildPalette(keys);
    expect(palette.k0.color).toBe("var(--chart-1)");
    expect(palette.k7.color).toBe("var(--chart-8)");
    expect(palette.k8.color).toBe("var(--chart-1)");
    expect(palette.k9.color).toBe("var(--chart-2)");
  });
});
