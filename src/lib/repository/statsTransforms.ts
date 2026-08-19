import { TokenUsage } from "@/generated/prisma/client";

export type ArticlesPerFeedRow = Record<string, string | number>;

export interface ArticlesPerFeedData {
  rows: ArticlesPerFeedRow[];
  feedKeys: string[];
  dailyAverage: number;
}

/** An article reduced to the two fields the daily-per-feed charts need. */
export interface DatedArticle {
  feedId: number;
  at: Date;
}

/**
 * Buckets articles into one row per day, with one key per feed, ready for a
 * stacked bar chart.
 *
 * There is one row per day in `dates`, so quiet days render as a gap rather
 * than being skipped. Days are the UTC calendar days used everywhere else in
 * the stats layer.
 *
 * Callers pick which date an article is filed under — its publication date, or
 * the moment it became read or filtered — by mapping it into `at`.
 *
 * Feeds are keyed by title so the chart legend and tooltip read as feed names
 * without a second lookup. Articles of a feed the caller did not pass a title
 * for are dropped.
 */
export function shapeArticlesPerFeedPerDay(
  dates: string[],
  articles: DatedArticle[],
  feedTitleById: Map<number, string>,
): ArticlesPerFeedData {
  const countsPerDay = new Map(
    dates.map((date) => [date, new Map<string, number>()]),
  );

  articles.forEach(({ feedId, at }) => {
    const counts = countsPerDay.get(at.toISOString().split("T")[0]);
    const title = feedTitleById.get(feedId);

    if (!counts || title === undefined) return;

    counts.set(title, (counts.get(title) ?? 0) + 1);
  });

  const days = [...countsPerDay.values()];

  const feedKeys = [...new Set(days.flatMap((counts) => [...counts.keys()]))];

  const total = days.reduce(
    (sum, counts) => sum + [...counts.values()].reduce((s, n) => s + n, 0),
    0,
  );

  const rows: ArticlesPerFeedRow[] = [...countsPerDay].map(
    ([date, counts]) => ({ date, ...Object.fromEntries(counts) }),
  );

  return {
    rows,
    feedKeys,
    dailyAverage: dates.length === 0 ? 0 : total / dates.length,
  };
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
