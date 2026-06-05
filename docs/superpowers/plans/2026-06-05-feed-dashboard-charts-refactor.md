# Feed Dashboard Charts — Code-Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the four chart components on `/feed` to remove duplication
(card chrome, palette helper, date formatters), lift data shaping into pure
transforms with unit tests, and move the LLM token-pricing table out of UI code.
No rendered output changes except a corrected per-day average in
`Your Daily Activity` for 30-day and 3-month ranges.

**Architecture:** Repository functions return chart-ready data (rows + derived
metadata + totals) by delegating to pure transforms in
`src/lib/repository/statsTransforms.ts`. A new `ChartCard` component owns the
shared `Card` + `ChartContainer` shell and the skeleton-on-undefined-data
branch. Each chart file shrinks to a render-only component that consumes the
pre-shaped data and the shared helpers (`buildPalette`, `useDateFormatters`).

**Tech Stack:** Next.js (App Router), React 19, Recharts via shadcn's
`ChartContainer` primitive, Prisma, Vitest. Tests live under `tests/unit/` and
import source via the `@/` alias.

---

## File map

**Create:**

- `src/lib/repository/statsTransforms.ts` — pure transforms.
- `src/lib/ai/tokenPricing.ts` — pricing table + cost calculation.
- `src/lib/charts/palette.ts` — color palette helper.
- `src/hooks/use-date-formatters.ts` — memoized `Intl.DateTimeFormat` pair.
- `src/app/feed/chart-card.tsx` — shared card shell.
- `tests/unit/statsTransforms.test.ts`
- `tests/unit/tokenPricing.test.ts`
- `tests/unit/palette.test.ts`

**Modify:**

- `src/lib/repository/statsRepository.ts` — three exports return pre-shaped
  data.
- `src/app/feed/dashboard.tsx` — state types match new shapes.
- `src/app/feed/daily-activity-chart.tsx` — adopt `ChartCard`, use
  `data.dailyAverage`.
- `src/app/feed/daily-new-articles-chart.tsx` — adopt `ChartCard`, palette
  helper, formatter hook.
- `src/app/feed/token-usage-chart.tsx` — adopt `ChartCard`, palette helper,
  formatter hook, `tokenPricing` import.
- `src/app/feed/unread-articles-pie-chart.tsx` — adopt `ChartCard` and palette
  helper.

**Untouched:** `src/app/feed/skeleton-chart.tsx` (consumed by `ChartCard`
as-is).

---

## Task 1: Add `CHART_COLORS` + `buildPalette`

**Files:**

- Create: `src/lib/charts/palette.ts`
- Test: `tests/unit/palette.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/palette.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/palette.test.ts` Expected: FAIL — cannot resolve
`@/lib/charts/palette`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/charts/palette.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/palette.test.ts` Expected: PASS — three tests
pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/charts/palette.ts tests/unit/palette.test.ts
git commit -m "feat(charts): add shared CHART_COLORS and buildPalette helper"
```

---

## Task 2: Add `tokenPricing` module

**Files:**

- Create: `src/lib/ai/tokenPricing.ts`
- Test: `tests/unit/tokenPricing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tokenPricing.test.ts`:

```ts
import { calculateTotalCost, TOKEN_PRICING } from "@/lib/ai/tokenPricing";
import { TokenUsage } from "@prisma/client";
import { describe, expect, it } from "vitest";

const u = (model: string, input: number, output: number): TokenUsage => ({
  id: 0,
  userId: "u",
  date: "2026-06-05",
  model,
  inputTokens: input,
  outputTokens: output,
  reasoningTokens: 0,
});

describe("TOKEN_PRICING", () => {
  it("includes the four known model entries", () => {
    expect(TOKEN_PRICING["claude-sonnet-4-20250514"]).toEqual({
      inputToken: 3 / 1_000_000,
      outputToken: 15 / 1_000_000,
    });
    expect(TOKEN_PRICING["gpt-4.1-nano"]).toEqual({
      inputToken: 0.1 / 1_000_000,
      outputToken: 0.4 / 1_000_000,
    });
    expect(TOKEN_PRICING["gpt-4.1-mini"]).toEqual({
      inputToken: 0.15 / 1_000_000,
      outputToken: 0.6 / 1_000_000,
    });
    expect(TOKEN_PRICING["gpt-5-nano"]).toEqual({
      inputToken: 0.05 / 1_000_000,
      outputToken: 0.4 / 1_000_000,
    });
  });
});

describe("calculateTotalCost", () => {
  it("returns 0 for empty usage", () => {
    expect(calculateTotalCost([])).toBe(0);
  });

  it("sums input + output cost for a known model", () => {
    const cost = calculateTotalCost([u("gpt-4.1-nano", 1_000_000, 500_000)]);
    // 1_000_000 * (0.1/1e6) + 500_000 * (0.4/1e6) = 0.1 + 0.2 = 0.3
    expect(cost).toBeCloseTo(0.3, 10);
  });

  it("ignores unknown models without throwing", () => {
    expect(calculateTotalCost([u("mystery-model", 1_000_000, 1_000_000)])).toBe(
      0,
    );
  });

  it("mixes known + unknown models correctly", () => {
    const cost = calculateTotalCost([
      u("gpt-4.1-nano", 1_000_000, 500_000),
      u("mystery-model", 9_999_999, 9_999_999),
    ]);
    expect(cost).toBeCloseTo(0.3, 10);
  });

  it("sums across multiple entries of the same model", () => {
    const cost = calculateTotalCost([
      u("gpt-4.1-nano", 500_000, 250_000),
      u("gpt-4.1-nano", 500_000, 250_000),
    ]);
    expect(cost).toBeCloseTo(0.3, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tokenPricing.test.ts` Expected: FAIL — cannot
resolve `@/lib/ai/tokenPricing`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/tokenPricing.ts`:

```ts
import { TokenUsage } from "@prisma/client";

export const TOKEN_PRICING: Record<
  string,
  { inputToken: number; outputToken: number }
> = {
  "claude-sonnet-4-20250514": {
    inputToken: 3 / 1_000_000,
    outputToken: 15 / 1_000_000,
  },
  "gpt-4.1-nano": {
    inputToken: 0.1 / 1_000_000,
    outputToken: 0.4 / 1_000_000,
  },
  "gpt-4.1-mini": {
    inputToken: 0.15 / 1_000_000,
    outputToken: 0.6 / 1_000_000,
  },
  "gpt-5-nano": {
    inputToken: 0.05 / 1_000_000,
    outputToken: 0.4 / 1_000_000,
  },
};

export function calculateTotalCost(usage: TokenUsage[]): number {
  const totalsByModel = usage.reduce(
    (acc, entry) => {
      if (!acc[entry.model]) {
        acc[entry.model] = { input: 0, output: 0 };
      }
      acc[entry.model].input += entry.inputTokens;
      acc[entry.model].output += entry.outputTokens;
      return acc;
    },
    {} as Record<string, { input: number; output: number }>,
  );

  return Object.entries(totalsByModel).reduce((cost, [model, tokens]) => {
    const pricing = TOKEN_PRICING[model];
    if (!pricing) return cost;
    return (
      cost +
      tokens.input * pricing.inputToken +
      tokens.output * pricing.outputToken
    );
  }, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tokenPricing.test.ts` Expected: PASS — all tests
pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tokenPricing.ts tests/unit/tokenPricing.test.ts
git commit -m "feat(ai): extract tokenPricing table and calculateTotalCost"
```

---

## Task 3: Add `statsTransforms` pure transforms

**Files:**

- Create: `src/lib/repository/statsTransforms.ts`
- Test: `tests/unit/statsTransforms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/statsTransforms.test.ts`:

```ts
import {
  computeDailyAverage,
  shapeArticlesPerFeedPerDay,
  shapeTokenUsage,
} from "@/lib/repository/statsTransforms";
import { TokenUsage } from "@prisma/client";
import { describe, expect, it } from "vitest";

const tu = (
  date: string,
  model: string,
  input: number,
  output: number,
  reasoning = 0,
): TokenUsage => ({
  id: 0,
  userId: "u",
  date,
  model,
  inputTokens: input,
  outputTokens: output,
  reasoningTokens: reasoning,
});

describe("computeDailyAverage", () => {
  it("returns 0 for empty input", () => {
    expect(computeDailyAverage([])).toBe(0);
  });

  it("divides total count by the number of rows", () => {
    expect(
      computeDailyAverage([
        { date: "d1", count: 4 },
        { date: "d2", count: 6 },
      ]),
    ).toBe(5);
  });
});

describe("shapeArticlesPerFeedPerDay", () => {
  it("returns empty result for empty input", () => {
    expect(shapeArticlesPerFeedPerDay([])).toEqual({
      rows: [],
      feedKeys: [],
      dailyAverage: 0,
    });
  });

  it("collects feed keys across rows, excluding 'date'", () => {
    const rows = [
      { date: "d1", FeedA: 2, FeedB: 3 },
      { date: "d2", FeedA: 1, FeedC: 4 },
    ];
    const result = shapeArticlesPerFeedPerDay(rows);
    expect(new Set(result.feedKeys)).toEqual(
      new Set(["FeedA", "FeedB", "FeedC"]),
    );
    expect(result.rows).toBe(rows);
  });

  it("computes dailyAverage from numeric feed values only", () => {
    const rows = [
      { date: "d1", FeedA: 2, FeedB: 3 },
      { date: "d2", FeedA: 5 },
    ];
    // total = 10, rows = 2
    expect(shapeArticlesPerFeedPerDay(rows).dailyAverage).toBe(5);
  });
});

describe("shapeTokenUsage", () => {
  it("returns empty result for empty input", () => {
    expect(shapeTokenUsage([])).toEqual({ rows: [], models: [] });
  });

  it("collapses multiple models on the same date into one row", () => {
    const result = shapeTokenUsage([
      tu("d1", "modelA", 10, 20, 0),
      tu("d1", "modelB", 30, 40, 5),
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      date: "d1",
      modelA_input: 10,
      modelA_output: 20,
      modelA_reasoning: 0,
      modelB_input: 30,
      modelB_output: 40,
      modelB_reasoning: 5,
    });
    expect(new Set(result.models)).toEqual(new Set(["modelA", "modelB"]));
  });

  it("creates one row per distinct date", () => {
    const result = shapeTokenUsage([
      tu("d1", "m", 1, 2, 0),
      tu("d2", "m", 3, 4, 0),
    ]);
    expect(result.rows.map((r) => r.date)).toEqual(["d1", "d2"]);
    expect(result.models).toEqual(["m"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/statsTransforms.test.ts` Expected: FAIL — cannot
resolve `@/lib/repository/statsTransforms`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/repository/statsTransforms.ts`:

```ts
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
    row[`${entry.model}_reasoning`] = entry.reasoningTokens;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/statsTransforms.test.ts` Expected: PASS — all
tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repository/statsTransforms.ts tests/unit/statsTransforms.test.ts
git commit -m "feat(stats): add pure transforms for chart-ready shapes"
```

---

## Task 4: Add `useDateFormatters` hook

**Files:**

- Create: `src/hooks/use-date-formatters.ts`

(No tests — thin wrapper over `Intl.DateTimeFormat`. The spec excludes it
explicitly.)

- [ ] **Step 1: Write the implementation**

Create `src/hooks/use-date-formatters.ts`:

```ts
import { useMemo } from "react";

export function useDateFormatters(): {
  short: Intl.DateTimeFormat;
  long: Intl.DateTimeFormat;
} {
  return useMemo(
    () => ({
      short: new Intl.DateTimeFormat(navigator.language, {
        day: "2-digit",
        month: "short",
      }),
      long: new Intl.DateTimeFormat(navigator.language, {
        dateStyle: "full",
      }),
    }),
    [],
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-date-formatters.ts
git commit -m "feat(hooks): add useDateFormatters for memoized Intl formatters"
```

---

## Task 5: Add `ChartCard` shared shell

**Files:**

- Create: `src/app/feed/chart-card.tsx`

(No unit test — the only branch is `data === undefined` rendering
`SkeletonChart`. The project has no React testing setup; the branch is covered
transitively when the four charts render in the dashboard.)

- [ ] **Step 1: Write the implementation**

Create `src/app/feed/chart-card.tsx`:

```tsx
"use client";

import { ReactNode } from "react";

import SkeletonChart from "@/app/feed/skeleton-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

interface ChartCardProps {
  title: string;
  description: string;
  footer?: ReactNode;
  config: ChartConfig;
  data: unknown | undefined;
  children: ReactNode;
  containerClassName?: string;
}

const ChartCard = ({
  title,
  description,
  footer,
  config,
  data,
  children,
  containerClassName,
}: ChartCardProps) => {
  if (data === undefined) {
    return <SkeletonChart title={title} description={description} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className={containerClassName}>
          {children as React.ComponentProps<typeof ChartContainer>["children"]}
        </ChartContainer>
      </CardContent>
      {footer && (
        <CardFooter className="text-center text-sm font-medium">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
};

export default ChartCard;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/chart-card.tsx
git commit -m "feat(feed): add ChartCard shell with skeleton fallback"
```

---

## Task 6: Update `statsRepository` to return chart-ready shapes

**Files:**

- Modify: `src/lib/repository/statsRepository.ts`

- [ ] **Step 1: Replace the file contents**

Open `src/lib/repository/statsRepository.ts` and replace
`getWeeklyArticleCountPerFeed`, `getWeeklyArticlesRead`, and
`getTokenUsageHistory` so the file becomes:

```ts
"use server";

import prisma from "@/lib/prismaClient";
import { calculateTotalCost } from "@/lib/ai/tokenPricing";
import {
  ArticlesPerFeedRow,
  computeDailyAverage,
  shapeArticlesPerFeedPerDay,
  shapeTokenUsage,
} from "@/lib/repository/statsTransforms";
import { getUserId } from "@/lib/repository/userRepository";

export const getNumberOfReadLaterArticles = async () => {
  const userId = await getUserId();
  return prisma.article.count({
    where: {
      readLater: true,
      userId,
    },
  });
};

export const getNumberOfUnreadArticles = async () => {
  const userId = await getUserId();
  return prisma.article.count({
    where: {
      readAt: null,
      readLater: false,
      userId,
    },
  });
};

export const getUnreadArticlesPerFeed = async () => {
  const userId = await getUserId();
  const feedWithUnreadArticleCount = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { readAt: null } },
        },
      },
    },
    where: { userId },
  });

  return feedWithUnreadArticleCount.map((feed) => {
    return {
      feedTitle: feed.title,
      unread: feed._count.articles,
    };
  });
};

const getDaysInDateRange = (from: Date, to: Date) => {
  if (from > to) {
    throw new Error("'from' date must be before or equal to 'to' date");
  }

  const dates: string[] = [];
  const current = new Date(from);

  while (current <= to) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

export const getWeeklyArticleCountPerFeed = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  const feeds = await prisma.feed.findMany({
    where: { userId },
    select: { id: true, title: true },
  });
  const feedTitleById = new Map(feeds.map((f) => [f.id, f.title]));

  const perDayPerFeed: ArticlesPerFeedRow[] = await Promise.all(
    dates.map(async (date) => {
      const groups = await prisma.article.groupBy({
        by: ["feedId"],
        _count: { _all: true },
        where: {
          publicationDate: {
            gte: `${date}T00:00:00.000Z`,
            lte: `${date}T23:59:59.999Z`,
          },
          userId,
        },
      });

      const entry: ArticlesPerFeedRow = { date };
      groups.forEach((g) => {
        const title = feedTitleById.get(g.feedId);
        if (title) {
          entry[title] = g._count._all;
        }
      });
      return entry;
    }),
  );

  return shapeArticlesPerFeedPerDay(perDayPerFeed);
};

export const getWeeklyArticlesRead = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  const articlesReadPerDay = await Promise.all(
    dates.map((date) =>
      prisma.article.aggregate({
        _count: {
          _all: true,
        },
        where: {
          readAt: {
            gte: `${date}T00:00:00.000Z`,
            lte: `${date}T23:59:59.999Z`,
          },
          userId,
        },
      }),
    ),
  );

  const rows = dates.map((date, index) => ({
    date,
    count: articlesReadPerDay[index]._count._all,
  }));

  return { rows, dailyAverage: computeDailyAverage(rows) };
};

export const getTokenUsageHistory = async (from: Date, to: Date) => {
  const userId = await getUserId();

  const dates = getDaysInDateRange(from, to);

  const raw = await prisma.tokenUsage.findMany({
    where: {
      userId,
      date: {
        in: dates,
      },
    },
  });

  const { rows, models } = shapeTokenUsage(raw);
  return { rows, models, totalCost: calculateTotalCost(raw) };
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: PASS — file resolves the new imports and
returns the new shapes. (There will still be type errors in dashboard/chart
callers — those are fixed in Tasks 7–11.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/repository/statsRepository.ts
git commit -m "refactor(stats): return chart-ready shapes from repository"
```

---

## Task 7: Refactor `daily-activity-chart` to use `ChartCard`

**Files:**

- Modify: `src/app/feed/daily-activity-chart.tsx`

- [ ] **Step 1: Replace the file contents**

Open `src/app/feed/daily-activity-chart.tsx` and replace its contents:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";

const chartConfig = {
  count: { label: "Articles" },
};

export interface DailyActivityData {
  rows: Array<{ date: string; count: number }>;
  dailyAverage: number;
}

interface DailyActivityChartProps {
  data?: DailyActivityData;
}

const DailyActivityChart = ({ data }: DailyActivityChartProps) => {
  const { short, long } = useDateFormatters();

  return (
    <ChartCard
      title="Your Daily Activity"
      description="Number of articles you interacted with each day"
      config={chartConfig}
      data={data}
      footer={data && `${data.dailyAverage.toFixed(2)} articles per day`}
    >
      <BarChart
        accessibilityLayer
        data={data?.rows}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => short.format(new Date(value))}
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent />}
          labelFormatter={(value) => long.format(new Date(value))}
        />
        <Bar dataKey="count" fill="var(--chart-1)" stackId="a" />
      </BarChart>
    </ChartCard>
  );
};

export default DailyActivityChart;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: errors only in `dashboard.tsx` (still imports
the old type). No errors in `daily-activity-chart.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/daily-activity-chart.tsx
git commit -m "refactor(feed): daily-activity-chart uses ChartCard"
```

---

## Task 8: Refactor `daily-new-articles-chart` to use `ChartCard`

**Files:**

- Modify: `src/app/feed/daily-new-articles-chart.tsx`

- [ ] **Step 1: Replace the file contents**

Open `src/app/feed/daily-new-articles-chart.tsx` and replace its contents:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";
import { buildPalette } from "@/lib/charts/palette";
import { ArticlesPerFeedRow } from "@/lib/repository/statsTransforms";

export interface DailyNewArticlesData {
  rows: ArticlesPerFeedRow[];
  feedKeys: string[];
  dailyAverage: number;
}

interface DailyNewArticlesChartProps {
  data?: DailyNewArticlesData;
}

const DailyNewArticlesChart = ({ data }: DailyNewArticlesChartProps) => {
  const { short, long } = useDateFormatters();
  const config = buildPalette(data?.feedKeys ?? []);

  return (
    <ChartCard
      title="Daily New Articles"
      description="Number of new articles that appeared in your feed each day"
      config={config}
      data={data}
      footer={data && `${data.dailyAverage.toFixed(2)} articles per day`}
    >
      <BarChart
        accessibilityLayer
        data={data?.rows}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => short.format(new Date(value))}
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(value) => long.format(new Date(value))}
        />
        {(data?.feedKeys ?? []).map((key) => (
          <Bar
            key={key}
            dataKey={key}
            fill={config[key]?.color}
            stroke={config[key]?.color}
            stackId="a"
          />
        ))}
      </BarChart>
    </ChartCard>
  );
};

export default DailyNewArticlesChart;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: errors only in `dashboard.tsx`. No errors in
`daily-new-articles-chart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/daily-new-articles-chart.tsx
git commit -m "refactor(feed): daily-new-articles-chart uses ChartCard"
```

---

## Task 9: Refactor `token-usage-chart` to use `ChartCard`

**Files:**

- Modify: `src/app/feed/token-usage-chart.tsx`

- [ ] **Step 1: Replace the file contents**

Open `src/app/feed/token-usage-chart.tsx` and replace its contents:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";
import { CHART_COLORS } from "@/lib/charts/palette";
import { TokenUsageRow } from "@/lib/repository/statsTransforms";

export interface TokenUsageData {
  rows: TokenUsageRow[];
  models: string[];
  totalCost: number;
}

interface TokenUsageChartProps {
  data?: TokenUsageData;
}

const buildModelTokenConfig = (models: string[]): ChartConfig => {
  const config: Record<string, { label: string; color: string }> = {};
  models.forEach((model, index) => {
    config[`${model}_input`] = {
      label: `${model} Input`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    config[`${model}_output`] = {
      label: `${model} Output`,
      color: CHART_COLORS[(index + models.length) % CHART_COLORS.length],
    };
    config[`${model}_reasoning`] = {
      label: `${model} Reasoning`,
      color: CHART_COLORS[(index + 2 * models.length) % CHART_COLORS.length],
    };
  });
  return config;
};

const TokenUsageChart = ({ data }: TokenUsageChartProps) => {
  const { short, long } = useDateFormatters();
  const config = buildModelTokenConfig(data?.models ?? []);

  return (
    <ChartCard
      title="Token Usage"
      description="Daily total of LLM tokens used by your AI Briefing Officer"
      config={config}
      data={data}
      footer={
        data && `$${data.totalCost.toFixed(2)} estimated cost for this period`
      }
    >
      <BarChart
        accessibilityLayer
        data={data?.rows}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => short.format(new Date(value))}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(value) => long.format(new Date(value))}
        />
        {(data?.models ?? []).flatMap((model) => [
          <Bar
            key={`${model}_input`}
            dataKey={`${model}_input`}
            fill={config[`${model}_input`].color}
            stackId="a"
          />,
          <Bar
            key={`${model}_output`}
            dataKey={`${model}_output`}
            fill={config[`${model}_output`].color}
            stackId="a"
          />,
          <Bar
            key={`${model}_reasoning`}
            dataKey={`${model}_reasoning`}
            fill={config[`${model}_reasoning`].color}
            stackId="a"
          />,
        ])}
      </BarChart>
    </ChartCard>
  );
};

export default TokenUsageChart;
```

`buildModelTokenConfig` is kept local — it's a token-usage-specific
3-variant-per-model encoding that doesn't generalize to `buildPalette`'s
1-color-per-key contract. It now consumes the shared `CHART_COLORS` constant.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: errors only in `dashboard.tsx`. No errors in
`token-usage-chart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/token-usage-chart.tsx
git commit -m "refactor(feed): token-usage-chart uses ChartCard and shared pricing"
```

---

## Task 10: Refactor `unread-articles-pie-chart` to use `ChartCard`

**Files:**

- Modify: `src/app/feed/unread-articles-pie-chart.tsx`

- [ ] **Step 1: Replace the file contents**

Open `src/app/feed/unread-articles-pie-chart.tsx` and replace its contents:

```tsx
"use client";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CHART_COLORS } from "@/lib/charts/palette";
import { Cell, Label, Pie, PieChart } from "recharts";

const chartConfig: ChartConfig = {
  feedTitle: { label: "Feed" },
};

export interface UnreadArticlesChartData {
  feedTitle: string;
  unread: number;
}

interface UnreadArticlesChartProps {
  chartData?: UnreadArticlesChartData[];
}

const UnreadArticlesPieChart = ({ chartData }: UnreadArticlesChartProps) => {
  const unreadArticlesInTotal = (chartData ?? []).reduce(
    (acc, feed) => acc + feed.unread,
    0,
  );

  return (
    <ChartCard
      title="Articles to Explore"
      description="Articles you haven’t dismissed or read yet"
      config={chartConfig}
      data={chartData}
      containerClassName="mx-auto aspect-square max-h-[250px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="unread"
          nameKey="feedTitle"
          innerRadius={60}
          strokeWidth={5}
        >
          {(chartData ?? []).map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {unreadArticlesInTotal}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 24}
                      className="fill-muted-foreground"
                    >
                      Total
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartCard>
  );
};

export default UnreadArticlesPieChart;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit` Expected: errors only in `dashboard.tsx`. No errors in
`unread-articles-pie-chart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/unread-articles-pie-chart.tsx
git commit -m "refactor(feed): unread-articles-pie-chart uses ChartCard"
```

---

## Task 11: Update `dashboard.tsx` to consume new shapes

**Files:**

- Modify: `src/app/feed/dashboard.tsx`

- [ ] **Step 1: Replace the file contents**

Open `src/app/feed/dashboard.tsx` and replace its contents:

```tsx
"use client";

import DailyActivityChart, {
  DailyActivityData,
} from "@/app/feed/daily-activity-chart";
import DailyNewArticlesChart, {
  DailyNewArticlesData,
} from "@/app/feed/daily-new-articles-chart";
import TokenUsageChart, { TokenUsageData } from "@/app/feed/token-usage-chart";
import UnreadArticlesPieChart, {
  UnreadArticlesChartData,
} from "@/app/feed/unread-articles-pie-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import { useEffect, useState } from "react";

export enum DateRangePreset {
  Last7Days = "Last 7 Days",
  Last30Days = "Last 30 Days",
  Last3Months = "Last 3 Months",
}

interface DateRange {
  from: Date;
  to: Date;
}

const getDateRangeFromPreset = (preset: DateRangePreset): DateRange => {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case DateRangePreset.Last7Days:
      from.setDate(to.getDate() - 7);
      break;
    case DateRangePreset.Last30Days:
      from.setDate(to.getDate() - 30);
      break;
    case DateRangePreset.Last3Months:
      from.setMonth(to.getMonth() - 3);
      break;
  }

  return { from, to };
};

const Dashboard = () => {
  const isMobile = useIsMobile();

  const [selectedRange, setSelectedRange] = useState<DateRangePreset>(
    DateRangePreset.Last7Days,
  );

  const [unreadArticlesChartData, setUnreadArticlesChartData] =
    useState<UnreadArticlesChartData[]>();
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageData>();
  const [dailyNewArticlesData, setDailyNewArticlesData] =
    useState<DailyNewArticlesData>();
  const [dailyActivityData, setDailyActivityData] =
    useState<DailyActivityData>();

  useEffect(() => {
    const dateRange = getDateRangeFromPreset(selectedRange);

    getUnreadArticlesPerFeed().then((data) => setUnreadArticlesChartData(data));

    getTokenUsageHistory(dateRange.from, dateRange.to).then((data) =>
      setTokenUsageData(data),
    );

    getWeeklyArticleCountPerFeed(dateRange.from, dateRange.to).then((data) =>
      setDailyNewArticlesData(data),
    );

    getWeeklyArticlesRead(dateRange.from, dateRange.to).then((data) =>
      setDailyActivityData(data),
    );
  }, [selectedRange]);

  return (
    <>
      {!isMobile && (
        <ToggleGroup
          className="mx-auto"
          onValueChange={(value) => setSelectedRange(value as DateRangePreset)}
          type="single"
          value={selectedRange}
          variant="outline"
        >
          {Object.values(DateRangePreset).map((range) => (
            <ToggleGroupItem key={range} value={range}>
              {range}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <div className="mx-auto hidden w-full max-w-7xl grid-cols-1 gap-4 md:visible md:grid md:grid-cols-2 lg:grid-cols-4">
        <UnreadArticlesPieChart chartData={unreadArticlesChartData} />
        <TokenUsageChart data={tokenUsageData} />
        <DailyNewArticlesChart data={dailyNewArticlesData} />
        <DailyActivityChart data={dailyActivityData} />
      </div>
    </>
  );
};

export default Dashboard;
```

- [ ] **Step 2: Verify the whole project type-checks**

Run: `npx tsc --noEmit` Expected: PASS — no errors anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/dashboard.tsx
git commit -m "refactor(feed): dashboard consumes pre-shaped chart data"
```

---

## Task 12: Full verification

**Files:** none

- [ ] **Step 1: Format**

Run: `npm run format` Expected: Prettier rewrites any unformatted files.

- [ ] **Step 2: Lint**

Run: `npm run lint` Expected: PASS — no ESLint errors.

- [ ] **Step 3: Tests**

Run: `npm run test` Expected: PASS — existing tests still pass; the three new
test files (palette, tokenPricing, statsTransforms) pass.

- [ ] **Step 4: Production build**

Run: `npm run build` Expected: PASS — Next.js build completes with no type
errors.

- [ ] **Step 5: Manual smoke**

Run: `npm run dev` Then in a browser, sign in and visit `/feed`. Confirm:

- All four chart cards render.
- Switching between `Last 7 Days` / `Last 30 Days` / `Last 3 Months` updates the
  charts.
- For the `Last 7 Days` range, `Your Daily Activity` footer shows the same
  number as before the refactor.
- For `Last 30 Days` and `Last 3 Months`, `Your Daily Activity` footer shows a
  different (corrected) number — divided by the actual day count, not by 7.
- Token-usage footer shows the same dollar value as before.

- [ ] **Step 6: Commit any formatter-only changes**

If `npm run format` modified files, commit them:

```bash
git status
git add -A
git commit -m "chore: prettier formatting"
```

If nothing changed, skip this step.

---

## Self-review check

- **Spec coverage:** every spec section maps to one or more tasks:
  - File map → Tasks 1–11.
  - `statsTransforms` API → Task 3.
  - `tokenPricing` API → Task 2.
  - `palette` API → Task 1.
  - `useDateFormatters` → Task 4.
  - `ChartCard` → Task 5.
  - Repository contract changes → Task 6.
  - Chart components after refactor → Tasks 7–10.
  - Dashboard state types → Task 11.
  - The deliberate behavior change (corrected per-day average) → Task 7 consumes
    `data.dailyAverage`, which Task 6's repo + Task 3's `computeDailyAverage`
    derive from `rows.length`.
  - Testing section → Tasks 1, 2, 3 (transforms, pricing, palette).
  - Verification gate → Task 12.

- **Placeholder scan:** no TBD/TODO/"add validation"/"similar to" in any task.

- **Type consistency:** `DailyActivityData`, `DailyNewArticlesData`,
  `TokenUsageData`, `ArticlesPerFeedRow`, `TokenUsageRow`,
  `UnreadArticlesChartData` are each defined once and reused everywhere with
  matching field names.
