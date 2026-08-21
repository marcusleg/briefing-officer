import { ChartConfig } from "@/components/ui/chart";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/**
 * A color per key, in `CHART_COLORS` order and wrapping around once the colors
 * run out. Keys that are not meant to be read — a namespaced feed key, say —
 * pass a `labelOf` to say what the legend and tooltip should show instead.
 */
export function buildPalette(
  keys: string[],
  labelOf: (key: string) => string = (key) => key,
): ChartConfig {
  const config: Record<string, { label: string; color: string }> = {};
  keys.forEach((key, i) => {
    config[key] = {
      label: labelOf(key),
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });
  return config;
}
