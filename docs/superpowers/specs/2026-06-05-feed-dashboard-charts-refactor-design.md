# Feed Dashboard Charts — Code Structure Refactor

## Goal

Reduce duplication and improve testability of the four chart components on
`/feed` without changing the rendered UI, except for one deliberate bug fix
called out below.

## Non-goals

- No new chart library (staying on Recharts + the existing shadcn
  `ChartContainer` wrapper).
- No layout, palette, or color-encoding redesign.
- No changes to mobile visibility behavior.
- No new charts, no removed charts.

## Background

`src/app/feed/dashboard.tsx` renders four charts:

- `unread-articles-pie-chart.tsx` — donut, unread articles per feed.
- `token-usage-chart.tsx` — stacked bars, tokens by model × {input, output,
  reasoning} per day.
- `daily-new-articles-chart.tsx` — stacked bars, new articles per feed per day.
- `daily-activity-chart.tsx` — single-color bars, articles interacted with per
  day.

Each file independently re-implements:

- Palette construction (`colors[i % colors.length]`) — three copies.
- Short/long `Intl.DateTimeFormat` pair — four copies.
- `Card` + `CardHeader` + `CardContent` + optional `CardFooter` shell — four
  copies.
- The `if (!chartData) return <SkeletonChart .../>` guard — four copies.

Two charts also inline non-trivial data shaping that belongs upstream:

- `token-usage-chart.tsx` reduces raw `TokenUsage[]` rows into per-date records
  with `${model}_{input|output|reasoning}` keys, and hardcodes a `tokenPricing`
  table to compute total cost.
- `daily-new-articles-chart.tsx` re-derives the set of feed keys from the rows
  that the repository just produced.

## Approach

Extract shared chrome and helpers, lift data shaping into pure transforms in the
repository layer, and shrink each chart file to a render-only component.

### New files

- `src/lib/repository/statsTransforms.ts` — pure transforms; no Prisma, no
  React.
- `src/lib/repository/statsTransforms.test.ts` — Vitest unit tests.
- `src/lib/ai/tokenPricing.ts` — pricing table + `calculateTotalCost`.
- `src/lib/ai/tokenPricing.test.ts` — Vitest unit tests.
- `src/lib/charts/palette.ts` — `CHART_COLORS` constant and `buildPalette(keys)`
  helper.
- `src/lib/charts/palette.test.ts` — Vitest unit tests.
- `src/hooks/use-date-formatters.ts` — memoized `{ short, long }`
  `Intl.DateTimeFormat` pair, keyed off `navigator.language`.
- `src/app/feed/chart-card.tsx` — shared `Card` + `ChartContainer` shell that
  swaps in `<SkeletonChart>` when `data === undefined`.
- `src/app/feed/chart-card.test.tsx` — React Testing Library test covering the
  `data === undefined` branch.

### Modified files

- `src/lib/repository/statsRepository.ts` — three of four exports return
  pre-shaped data with derived metadata. See "Repository contract changes."
- `src/app/feed/dashboard.tsx` — state types updated to match new return shapes;
  structure of the `useEffect` is unchanged.
- `src/app/feed/daily-activity-chart.tsx` — render-only.
- `src/app/feed/daily-new-articles-chart.tsx` — render-only.
- `src/app/feed/token-usage-chart.tsx` — render-only.
- `src/app/feed/unread-articles-pie-chart.tsx` — render-only.

`src/app/feed/skeleton-chart.tsx` is unchanged; it remains used by `ChartCard`.

## Repository contract changes

The repository becomes the boundary that returns chart-ready data.

- `getUnreadArticlesPerFeed()` → unchanged. Returns
  `Array<{ feedTitle: string; unread: number }>`.

- `getWeeklyArticleCountPerFeed(from, to)` →
  `{ rows: Array<Record<string, string | number>>; feedKeys: string[]; dailyAverage: number }`.
  `feedKeys` is the union of feed-title keys present across the rows (excluding
  `"date"`). `dailyAverage` is the total article count across all rows and
  feeds, divided by `rows.length` (or `0` when `rows` is empty).

- `getWeeklyArticlesRead(from, to)` →
  `{ rows: Array<{ date: string; count: number }>; dailyAverage: number }`.
  `dailyAverage` is `sum(rows.count) / rows.length` (or `0` when empty).

- `getTokenUsageHistory(from, to)` →
  `{ rows: Array<Record<string, string | number>>; models: string[]; totalCost: number }`.
  Each row has shape
  `{ date, [`${model}_input`]: n, [`${model}\_output`]: n, [`${model}\_reasoning`]: n, ... }`.
  `models` is the deduplicated set of model names present in the raw data.
  `totalCost` is computed by `calculateTotalCost` using the pricing table;
  unknown models contribute `0` and do not throw.

The repository imports the pure transforms from `statsTransforms.ts` and the
pricing helper from `tokenPricing.ts`. The shaping logic itself is not in the
repository module — it is tested independently.

Specifically:

- `getWeeklyArticleCountPerFeed` continues to build the per-day rows from Prisma
  `groupBy` calls as today, then passes the rows to `shapeArticlesPerFeedPerDay`
  to derive `feedKeys` and `dailyAverage`.
- `getTokenUsageHistory` continues to query `prisma.tokenUsage.findMany`, then
  passes the raw `TokenUsage[]` to `shapeTokenUsage` and `calculateTotalCost`.
- `getWeeklyArticlesRead` continues to build per-day rows from Prisma, then
  passes them to `computeDailyAverage`.

## `statsTransforms.ts` API

```ts
export function shapeArticlesPerFeedPerDay(
  rows: Array<Record<string, string | number>>,
): {
  rows: Array<Record<string, string | number>>;
  feedKeys: string[];
  dailyAverage: number;
};

export function shapeTokenUsage(raw: TokenUsage[]): {
  rows: Array<Record<string, string | number>>;
  models: string[];
};

export function computeDailyAverage(
  rows: Array<{ date: string; count: number }>,
): number;
```

All three are pure: no I/O, no React, no Prisma client.

## `tokenPricing.ts` API

```ts
export const TOKEN_PRICING: Record<
  string,
  { inputToken: number; outputToken: number }
>;

export function calculateTotalCost(usage: TokenUsage[]): number;
```

Pricing values move verbatim from `token-usage-chart.tsx` lines 104–112 — no
value changes. `calculateTotalCost` matches the existing computation: sum
`input × inputToken + output × outputToken` per model, skipping models not in
`TOKEN_PRICING`.

## `palette.ts` API

```ts
export const CHART_COLORS: readonly string[]; // ["var(--chart-1)", ..., "var(--chart-8)"]

export function buildPalette(keys: string[]): ChartConfig;
```

`buildPalette` produces the same
`Record<string, { label: string; color: string }>` the existing inline helpers
do, with `colors[i % colors.length]` wrap-around.

## `useDateFormatters` hook

```ts
export function useDateFormatters(): {
  short: Intl.DateTimeFormat; // { day: "2-digit", month: "short" }
  long: Intl.DateTimeFormat; // { dateStyle: "full" }
};
```

Memoizes both formatters with `useMemo`, keyed off `navigator.language`. Same
options the four chart files currently construct inline.

## `ChartCard` shell

```tsx
interface ChartCardProps {
  title: string;
  description: string;
  footer?: ReactNode;
  config: ChartConfig;
  data: unknown | undefined;
  children: ReactNode;
  containerClassName?: string;
}
```

Behavior:

- If `data === undefined`, render
  `<SkeletonChart title={title} description={description} />` and nothing else.
- Otherwise render `<Card>` → `<CardHeader>` (`<CardTitle>` +
  `<CardDescription>`) → `<CardContent>` →
  `<ChartContainer config={config} className={containerClassName}>{children}</ChartContainer>`,
  followed by `<CardFooter>{footer}</CardFooter>` when `footer` is truthy.

The `containerClassName` prop exists solely so the pie chart can pass
`"mx-auto aspect-square max-h-[250px]"`, matching its current behavior.

## Chart component shape after refactor

Each chart file becomes ~30 lines: imports, the props interface, the component
returning `<ChartCard>` wrapping a Recharts body. Sketch for
`daily-activity-chart.tsx`:

```tsx
const DailyActivityChart = ({ data }: { data?: DailyActivityData }) => {
  const { short, long } = useDateFormatters();
  return (
    <ChartCard
      title="Your Daily Activity"
      description="Number of articles you interacted with each day"
      config={CHART_CONFIG}
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
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(v) => short.format(new Date(v))}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent />}
          labelFormatter={(v) => long.format(new Date(v))}
        />
        <Bar dataKey="count" fill="var(--chart-1)" stackId="a" />
      </BarChart>
    </ChartCard>
  );
};
```

`token-usage-chart.tsx`, `daily-new-articles-chart.tsx`, and
`unread-articles-pie-chart.tsx` follow the same shape with their respective
Recharts bodies and `config` derived via `buildPalette(...)`.

## Dashboard changes

`dashboard.tsx` keeps its `useEffect` structure. Only the state types change:

```ts
const [unreadArticlesChartData, setUnreadArticlesChartData] =
  useState<UnreadArticlesChartData[]>();
const [tokenUsageChartData, setTokenUsageChartData] =
  useState<TokenUsageData>(); // was TokenUsage[]
const [numberOfNewArticlesChartData, setNumberOfNewArticlesChartData] =
  useState<DailyNewArticlesData>(); // was NumberOfArticlesLast7DaysChartData[]
const [weeklyArticlesReadChartData, setWeeklyArticlesReadChartData] =
  useState<DailyActivityData>(); // was NumberOfArticlesReadLast7DaysChartData[]
```

The four `.then(setX)` calls now consume the new bundled return shapes; no
restructuring of the effect.

## Behavior change (the one allowed exception)

`daily-activity-chart.tsx:54` currently computes the footer's "articles per day"
by dividing the period total by hardcoded `7`, regardless of whether the
selected range is 7 days, 30 days, or 3 months.

`computeDailyAverage` divides by `rows.length`. For the 30-day and 3-month
ranges, the footer number will change. The 7-day range produces the same result
as before.

This is the only user-visible change in the refactor.

## Testing

New unit tests (Vitest, no DB, no React beyond `chart-card.test.tsx`):

- `statsTransforms.test.ts`
  - `shapeArticlesPerFeedPerDay`: feed key discovery across mixed rows; empty
    input → `dailyAverage: 0`; rows containing `string` values (e.g. `date`) are
    not summed.
  - `shapeTokenUsage`: multiple models on the same date collapse into one row;
    single model passthrough; empty input.
  - `computeDailyAverage`: divides by `rows.length`; empty input → `0`.
- `tokenPricing.test.ts`
  - `calculateTotalCost`: known model produces expected cost; unknown model
    contributes `0` without throwing; mixed known + unknown; empty input → `0`.
- `palette.test.ts`
  - `buildPalette`: wrap-around when `keys.length > 8`; empty input → `{}`;
    labels match the input keys.
- `chart-card.test.tsx`
  - `data === undefined` renders `<SkeletonChart>` and not the children.
  - `data` defined renders the children inside the card.

Not tested:

- `useDateFormatters` — thin wrapper over `Intl.DateTimeFormat`.
- Individual chart components — render-only after refactor; their inputs are
  covered by the transform and pricing tests.

## Verification before claiming done

- `npm run format`
- `npm run lint`
- `npm run test`
- `npm run build`

Manual smoke: load `/feed`, switch through all three date-range presets, confirm
all four charts render. The daily-activity footer for 30-day and 3-month ranges
is expected to differ from the previous value; everything else matches.

## Out of scope

- Color/palette coherence across charts.
- Mobile dashboard visibility.
- Skeleton aspect-ratio matching the real chart.
- Token-usage stacking strategy (input/output/reasoning sharing slots in the
  same 8-color palette).
- Range-toggle layout.
- Any change to `unread-articles-pie-chart.tsx` beyond adopting `ChartCard` and
  the shared palette helper.
