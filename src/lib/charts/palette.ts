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

export function buildPalette(keys: string[]): ChartConfig {
  const config: Record<string, { label: string; color: string }> = {};
  keys.forEach((key, i) => {
    config[key] = {
      label: key,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });
  return config;
}
