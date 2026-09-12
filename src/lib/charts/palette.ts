import { ChartConfig } from "@/components/ui/chart";
import { feedKey } from "@/lib/repository/statsTransforms";

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

/** A series, as the chart identifies it and as the reader sees it. */
export interface PaletteEntry {
  key: string;
  label: string;
}

/**
 * A color per entry, in `CHART_COLORS` order and wrapping around once the
 * colors run out.
 *
 * Key and label are separate on purpose: the key is the series' identity (a
 * feed id, say) and has to be unique, while the label is display text two
 * series may well share. The tooltip and legend render `label`, so the key
 * never has to be readable.
 *
 * Colors follow the order of `entries`, so callers that want a series to keep
 * its color across several charts pass the same entries to each of them.
 */
export function buildPalette(entries: PaletteEntry[]): ChartConfig {
  const config: Record<string, { label: string; color: string }> = {};
  entries.forEach(({ key, label }, i) => {
    config[key] = { label, color: CHART_COLORS[i % CHART_COLORS.length] };
  });
  return config;
}

/**
 * The one feed-to-color map the dashboard hands every chart.
 *
 * Built once from the user's whole feed list rather than per chart from the
 * feeds that happen to have rows there: a feed absent from one chart would
 * otherwise shift the color of every feed after it, and the same feed would
 * read as a different color in each chart of the row.
 */
export function buildFeedPalette(
  feeds: { id: number; title: string }[],
): ChartConfig {
  return buildPalette(
    feeds.map(({ id, title }) => ({ key: feedKey(id), label: title })),
  );
}
