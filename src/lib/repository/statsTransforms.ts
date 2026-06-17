import { TokenUsage } from "@prisma/client";

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

export function computeDailyAverage(
  rows: Array<{ date: string; count: number }>,
): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return total / rows.length;
}
