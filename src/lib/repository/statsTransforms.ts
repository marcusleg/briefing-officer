import { ArticleStatus, TokenUsage } from "@/generated/prisma/client";

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

export interface RejectedArticlesRow {
  date: string;
  filtered: number;
  notInterested: number;
}

/**
 * Counts rejected articles per day, split by who rejected them: the model
 * (`FILTERED`) or the reader (`NOT_INTERESTED`). Keeping the two apart lets the
 * chart stack them, so the total answers "how much never reached me" while the
 * lower segment alone still shows how the interest profile is doing.
 *
 * There is one row per day in `dates`, so quiet days render as a gap rather
 * than being skipped. Days are the UTC calendar days used everywhere else in
 * the stats layer.
 */
export function shapeRejectedArticlesPerDay(
  dates: string[],
  articles: Array<{ status: ArticleStatus; statusChangedAt: Date }>,
): RejectedArticlesRow[] {
  const rows = new Map(
    dates.map((date) => [date, { date, filtered: 0, notInterested: 0 }]),
  );

  articles.forEach((article) => {
    const row = rows.get(article.statusChangedAt.toISOString().split("T")[0]);
    if (!row) {
      return;
    }

    if (article.status === "FILTERED") {
      row.filtered += 1;
    } else if (article.status === "NOT_INTERESTED") {
      row.notInterested += 1;
    }
  });

  return dates.map(
    (date) => rows.get(date) ?? { date, filtered: 0, notInterested: 0 },
  );
}

export function computeDailyAverage(
  rows: Array<{ date: string; count: number }>,
): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return total / rows.length;
}
