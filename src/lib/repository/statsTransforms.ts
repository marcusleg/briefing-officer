import { TokenUsage } from "@/generated/prisma/client";

export type ArticlesPerFeedRow = Record<string, string | number>;

export function shapeArticlesPerFeedPerDay(rows: ArticlesPerFeedRow[]): {
  rows: ArticlesPerFeedRow[];
  feedKeys: string[];
  dailyAverage: number;
} {
  const feedKeys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "date") set.add(k);
      });
      return set;
    }, new Set<string>()),
  );

  const total = rows.reduce((sum, row) => {
    return (
      sum +
      feedKeys.reduce((s, k) => {
        const v = row[k];
        return s + (typeof v === "number" ? v : 0);
      }, 0)
    );
  }, 0);

  const dailyAverage = rows.length === 0 ? 0 : total / rows.length;

  return { rows, feedKeys, dailyAverage };
}

export type TokenUsageRow = Record<string, string | number>;

export function shapeTokenUsage(raw: TokenUsage[]): {
  rows: TokenUsageRow[];
  models: string[];
} {
  const rows: TokenUsageRow[] = [];

  raw.forEach((entry) => {
    let row = rows.find((r) => r.date === entry.date);
    if (!row) {
      row = { date: entry.date };
      rows.push(row);
    }
    row[`${entry.model}_input`] = entry.inputTokens;
    row[`${entry.model}_output`] = entry.outputTokens;
  });

  const models = [...new Set(raw.map((entry) => entry.model))];

  return { rows, models };
}

/**
 * Buckets articles into one row per day, with one key per feed, ready for a
 * stacked bar chart.
 *
 * There is one row per day in `dates`, so quiet days render as a gap rather
 * than being skipped. Days are the UTC calendar days used everywhere else in
 * the stats layer.
 *
 * Articles are bucketed by `statusChangedAt` — the moment they became read or
 * filtered — because both callers (`getWeeklyArticlesRead` and
 * `getFilteredArticlesPerDay` in statsRepository.ts) already constrain their
 * query to a single status, so there is no status field left to check here.
 *
 * Feeds are keyed by title, matching `shapeArticlesPerFeedPerDay`, so the chart
 * legend and tooltip read as feed names without a second lookup. Articles of a
 * feed the caller did not pass a title for are dropped.
 */
export function shapeStatusChangesPerFeedPerDay(
  dates: string[],
  articles: Array<{ feedId: number; statusChangedAt: Date }>,
  feedTitleById: Map<number, string>,
) {
  const rows: ArticlesPerFeedRow[] = dates.map((date) => ({ date }));
  const rowByDate = new Map(rows.map((row) => [row.date as string, row]));

  articles.forEach(({ feedId, statusChangedAt }) => {
    const row = rowByDate.get(statusChangedAt.toISOString().split("T")[0]);
    const title = feedTitleById.get(feedId);

    if (!row || title === undefined) return;

    const current = row[title];
    row[title] = (typeof current === "number" ? current : 0) + 1;
  });

  return shapeArticlesPerFeedPerDay(rows);
}
