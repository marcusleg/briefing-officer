import { TokenUsage } from "@/generated/prisma/client";

export type ArticlesPerFeedRow = Record<string, string | number>;

export interface ArticlesPerFeedData {
  rows: ArticlesPerFeedRow[];
  feedKeys: string[];
  dailyAverage: number;
}

/**
 * Feed keys share a row with the row's `date`, so they live behind a prefix no
 * date key can collide with. `feedKey` is the only place that spells it out.
 */
const FEED_KEY_PREFIX = "feed:";

/**
 * The row key a feed's daily counts are filed under.
 *
 * Keyed by id rather than by title: `Feed` is unique only on
 * `[userId, link]`, so two feeds the reader named the same would otherwise
 * collapse into one stacked segment, and renaming a feed would silently
 * re-key its data. Charts get their display text from `ChartConfig.label`.
 */
export const feedKey = (feedId: number) => `${FEED_KEY_PREFIX}${feedId}`;

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
 * Articles of a feed missing from `knownFeedIds` are dropped.
 */
export function shapeArticlesPerFeedPerDay(
  dates: string[],
  articles: DatedArticle[],
  knownFeedIds: Set<number>,
): ArticlesPerFeedData {
  const countsPerDay = new Map(
    dates.map((date) => [date, new Map<string, number>()]),
  );

  articles.forEach(({ feedId, at }) => {
    const counts = countsPerDay.get(at.toISOString().split("T")[0]);

    if (!counts || !knownFeedIds.has(feedId)) return;

    const key = feedKey(feedId);

    counts.set(key, (counts.get(key) ?? 0) + 1);
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
