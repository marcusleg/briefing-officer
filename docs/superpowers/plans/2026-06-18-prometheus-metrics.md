# Prometheus Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose bearer-token protected Prometheus metrics at `/api/metrics`,
including DB-backed gauges and runtime counters.

**Architecture:** Add `prom-client` for runtime counters, a small repository for
scrape-time DB gauge values, a formatter for gauge exposition text, and a
Next.js route that joins gauges with runtime counter output. Instrument existing
feed, AI lead, AI summary, and token usage paths through helper functions so
metrics recording stays isolated from product behavior.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Prisma, Vitest,
`prom-client`, SQLite test database.

---

## File Structure

- Create `src/lib/metrics.ts`: Prometheus registry, runtime counter definitions,
  reset helper for tests, and recording functions.
- Create `src/lib/metricsRepository.ts`: Prisma queries for gauge values.
- Create `src/lib/metricsFormatter.ts`: deterministic Prometheus text formatter
  for DB-backed gauges.
- Create `src/app/api/metrics/route.ts`: bearer-token auth, gauge collection,
  runtime metric rendering, response status and content type.
- Create `tests/unit/metrics.test.ts`: runtime counter and gauge formatter unit
  tests.
- Create `tests/integration/metricsRepository.test.ts`: DB-backed gauge query
  tests.
- Create `tests/integration/metricsRoute.test.ts`: route auth and response
  tests.
- Modify `src/lib/repository/feedRepository.ts`: record article scrape outcome
  counters.
- Modify `src/lib/ai/services/leadService.ts`: record AI lead outcome counters.
- Modify `src/lib/ai/services/summaryService.ts`: record AI summary outcome
  counters.
- Modify `src/lib/ai/services/tokenUsageService.ts`: record language model token
  counters.
- Modify `tests/integration/feedRepository.test.ts`: assert scrape counters on
  success and error.
- Modify `tests/integration/leadService.test.ts`: assert AI lead and token
  counters.
- Modify or create `tests/integration/summaryService.test.ts`: assert AI summary
  and token counters.
- Modify `package.json` and `package-lock.json`: add `prom-client`.

## Metrics Contract

Gauges:

```text
briefing_officer_users_total
briefing_officer_feeds_total{user_id}
briefing_officer_articles_total{user_id,feed_name}
briefing_officer_articles_unread_total{user_id,feed_name}
briefing_officer_articles_read_later_total{user_id,feed_name}
briefing_officer_articles_starred_total{user_id,feed_name}
```

Counters:

```text
briefing_officer_article_scrapes_total{user_id,feed_name,status="success|error"}
briefing_officer_ai_lead_generations_total{user_id,feed_name,status="success|error"}
briefing_officer_ai_summary_generations_total{user_id,feed_name,status="success|error"}
briefing_officer_language_model_tokens_total{model,direction="input|output"}
```

## Task 1: Add Prometheus Client Dependency

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install `prom-client`**

Run:

```bash
npm install prom-client
```

Expected: `package.json` gains a `prom-client` dependency and
`package-lock.json` is updated.

- [ ] **Step 2: Verify dependency resolves**

Run:

```bash
npm ls prom-client
```

Expected: output includes `prom-client@...` under `briefing-officer@0.10.0`.

- [ ] **Step 3: Commit dependency update**

Run:

```bash
git add package.json package-lock.json
git commit -m "build: add prometheus client dependency" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds and Husky/lint-staged does not report errors.

## Task 2: Runtime Counter Registry

**Files:**

- Create: `src/lib/metrics.ts`
- Create: `tests/unit/metrics.test.ts`

- [ ] **Step 1: Write failing runtime counter tests**

Create `tests/unit/metrics.test.ts`:

```ts
import {
  getMetricsText,
  recordAiLeadGeneration,
  recordAiSummaryGeneration,
  recordArticleScrape,
  recordLanguageModelTokens,
  resetMetricsForTests,
} from "@/lib/metrics";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  resetMetricsForTests();
});

describe("runtime Prometheus metrics", () => {
  it("records article scrape outcomes by user, feed, and status", async () => {
    recordArticleScrape({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "success",
    });
    recordArticleScrape({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "error",
    });

    const output = await getMetricsText();

    expect(output).toContain(
      "# TYPE briefing_officer_article_scrapes_total counter",
    );
    expect(output).toContain(
      'briefing_officer_article_scrapes_total{user_id="user-1",feed_name="Tech Feed",status="success"} 1',
    );
    expect(output).toContain(
      'briefing_officer_article_scrapes_total{user_id="user-1",feed_name="Tech Feed",status="error"} 1',
    );
  });

  it("records AI generation outcomes and language model tokens", async () => {
    recordAiLeadGeneration({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "success",
    });
    recordAiSummaryGeneration({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "error",
    });
    recordLanguageModelTokens({
      model: "test-model",
      direction: "input",
      tokens: 7,
    });
    recordLanguageModelTokens({
      model: "test-model",
      direction: "output",
      tokens: 3,
    });

    const output = await getMetricsText();

    expect(output).toContain(
      'briefing_officer_ai_lead_generations_total{user_id="user-1",feed_name="Tech Feed",status="success"} 1',
    );
    expect(output).toContain(
      'briefing_officer_ai_summary_generations_total{user_id="user-1",feed_name="Tech Feed",status="error"} 1',
    );
    expect(output).toContain(
      'briefing_officer_language_model_tokens_total{model="test-model",direction="input"} 7',
    );
    expect(output).toContain(
      'briefing_officer_language_model_tokens_total{model="test-model",direction="output"} 3',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- tests/unit/metrics.test.ts
```

Expected: FAIL because `@/lib/metrics` does not exist.

- [ ] **Step 3: Implement runtime metrics module**

Create `src/lib/metrics.ts`:

```ts
import { Counter, Registry } from "prom-client";

export type OperationStatus = "success" | "error";
export type TokenDirection = "input" | "output";

type FeedEvent = {
  userId: string;
  feedName: string;
  status: OperationStatus;
};

type TokenEvent = {
  model: string;
  direction: TokenDirection;
  tokens: number;
};

let registry: Registry;
let articleScrapes: Counter<"user_id" | "feed_name" | "status">;
let aiLeadGenerations: Counter<"user_id" | "feed_name" | "status">;
let aiSummaryGenerations: Counter<"user_id" | "feed_name" | "status">;
let languageModelTokens: Counter<"model" | "direction">;

const createRegistry = () => {
  registry = new Registry();

  articleScrapes = new Counter({
    name: "briefing_officer_article_scrapes_total",
    help: "Total article scrape attempts by outcome.",
    labelNames: ["user_id", "feed_name", "status"],
    registers: [registry],
  });

  aiLeadGenerations = new Counter({
    name: "briefing_officer_ai_lead_generations_total",
    help: "Total AI lead generation attempts by outcome.",
    labelNames: ["user_id", "feed_name", "status"],
    registers: [registry],
  });

  aiSummaryGenerations = new Counter({
    name: "briefing_officer_ai_summary_generations_total",
    help: "Total AI summary generation attempts by outcome.",
    labelNames: ["user_id", "feed_name", "status"],
    registers: [registry],
  });

  languageModelTokens = new Counter({
    name: "briefing_officer_language_model_tokens_total",
    help: "Total language model tokens used.",
    labelNames: ["model", "direction"],
    registers: [registry],
  });
};

createRegistry();

export const resetMetricsForTests = () => {
  createRegistry();
};

export const recordArticleScrape = (event: FeedEvent) => {
  articleScrapes.inc({
    user_id: event.userId,
    feed_name: event.feedName,
    status: event.status,
  });
};

export const recordAiLeadGeneration = (event: FeedEvent) => {
  aiLeadGenerations.inc({
    user_id: event.userId,
    feed_name: event.feedName,
    status: event.status,
  });
};

export const recordAiSummaryGeneration = (event: FeedEvent) => {
  aiSummaryGenerations.inc({
    user_id: event.userId,
    feed_name: event.feedName,
    status: event.status,
  });
};

export const recordLanguageModelTokens = (event: TokenEvent) => {
  if (event.tokens <= 0) {
    return;
  }

  languageModelTokens.inc(
    { model: event.model, direction: event.direction },
    event.tokens,
  );
};

export const getMetricsText = () => registry.metrics();
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test -- tests/unit/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit runtime metrics module**

Run:

```bash
git add src/lib/metrics.ts tests/unit/metrics.test.ts
git commit -m "feat: add runtime metrics counters" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds.

## Task 3: DB Gauge Collection and Formatting

**Files:**

- Create: `src/lib/metricsRepository.ts`
- Create: `src/lib/metricsFormatter.ts`
- Create: `tests/integration/metricsRepository.test.ts`
- Modify: `tests/unit/metrics.test.ts`

- [ ] **Step 1: Write failing formatter tests**

Append to `tests/unit/metrics.test.ts`:

```ts
import { formatGaugeMetrics } from "@/lib/metricsFormatter";

describe("gauge metric formatter", () => {
  it("formats DB-backed gauges with HELP and TYPE lines", () => {
    const output = formatGaugeMetrics({
      usersTotal: 1,
      feeds: [{ userId: "user-1", count: 2 }],
      articles: [
        {
          userId: "user-1",
          feedName: 'Tech "Daily"',
          total: 3,
          unread: 2,
          readLater: 1,
          starred: 1,
        },
      ],
    });

    expect(output).toContain("# TYPE briefing_officer_users_total gauge");
    expect(output).toContain("briefing_officer_users_total 1");
    expect(output).toContain(
      'briefing_officer_feeds_total{user_id="user-1"} 2',
    );
    expect(output).toContain(
      'briefing_officer_articles_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 3',
    );
    expect(output).toContain(
      'briefing_officer_articles_unread_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 2',
    );
    expect(output).toContain(
      'briefing_officer_articles_read_later_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 1',
    );
    expect(output).toContain(
      'briefing_officer_articles_starred_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 1',
    );
  });
});
```

- [ ] **Step 2: Run formatter test to verify it fails**

Run:

```bash
npm run test -- tests/unit/metrics.test.ts
```

Expected: FAIL because `@/lib/metricsFormatter` does not exist.

- [ ] **Step 3: Implement gauge formatter**

Create `src/lib/metricsFormatter.ts`:

```ts
export type GaugeMetrics = {
  usersTotal: number;
  feeds: Array<{ userId: string; count: number }>;
  articles: Array<{
    userId: string;
    feedName: string;
    total: number;
    unread: number;
    readLater: number;
    starred: number;
  }>;
};

const escapeLabelValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');

const labels = (values: Record<string, string>) => {
  const rendered = Object.entries(values)
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",");
  return `{${rendered}}`;
};

const metric = (
  name: string,
  help: string,
  rows: Array<{ labels?: Record<string, string>; value: number }>,
) => {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`];
  rows.forEach((row) => {
    lines.push(`${name}${row.labels ? labels(row.labels) : ""} ${row.value}`);
  });
  return lines.join("\n");
};

export const formatGaugeMetrics = (metrics: GaugeMetrics) => {
  return [
    metric("briefing_officer_users_total", "Current number of users.", [
      { value: metrics.usersTotal },
    ]),
    metric("briefing_officer_feeds_total", "Current number of feeds by user.", [
      ...metrics.feeds.map((feed) => ({
        labels: { user_id: feed.userId },
        value: feed.count,
      })),
    ]),
    metric(
      "briefing_officer_articles_total",
      "Current number of articles by user and feed.",
      metrics.articles.map((row) => ({
        labels: { user_id: row.userId, feed_name: row.feedName },
        value: row.total,
      })),
    ),
    metric(
      "briefing_officer_articles_unread_total",
      "Current number of unread articles by user and feed.",
      metrics.articles.map((row) => ({
        labels: { user_id: row.userId, feed_name: row.feedName },
        value: row.unread,
      })),
    ),
    metric(
      "briefing_officer_articles_read_later_total",
      "Current number of read-later articles by user and feed.",
      metrics.articles.map((row) => ({
        labels: { user_id: row.userId, feed_name: row.feedName },
        value: row.readLater,
      })),
    ),
    metric(
      "briefing_officer_articles_starred_total",
      "Current number of starred articles by user and feed.",
      metrics.articles.map((row) => ({
        labels: { user_id: row.userId, feed_name: row.feedName },
        value: row.starred,
      })),
    ),
  ].join("\n\n");
};
```

- [ ] **Step 4: Run formatter tests**

Run:

```bash
npm run test -- tests/unit/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing repository tests**

Create `tests/integration/metricsRepository.test.ts`:

```ts
import { collectGaugeMetrics } from "@/lib/metricsRepository";
import { beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId, title: "Tech Feed" })).id;
});

describe("collectGaugeMetrics", () => {
  it("collects user, feed, and article gauges", async () => {
    await createArticle({ userId, feedId });
    await createArticle({ userId, feedId, readAt: new Date() });
    await createArticle({ userId, feedId, readLater: true });
    await createArticle({ userId, feedId, starred: true });

    const metrics = await collectGaugeMetrics();

    expect(metrics).toEqual({
      usersTotal: 1,
      feeds: [{ userId, count: 1 }],
      articles: [
        {
          userId,
          feedName: "Tech Feed",
          total: 4,
          unread: 3,
          readLater: 1,
          starred: 1,
        },
      ],
    });
  });
});
```

- [ ] **Step 6: Run repository test to verify it fails**

Run:

```bash
npm run test -- tests/integration/metricsRepository.test.ts
```

Expected: FAIL because `@/lib/metricsRepository` does not exist.

- [ ] **Step 7: Implement gauge repository**

Create `src/lib/metricsRepository.ts`:

```ts
import { GaugeMetrics } from "@/lib/metricsFormatter";
import prisma from "@/lib/prismaClient";

export const collectGaugeMetrics = async (): Promise<GaugeMetrics> => {
  const usersTotal = await prisma.user.count();

  const feedGroups = await prisma.feed.groupBy({
    by: ["userId"],
    _count: { _all: true },
    orderBy: { userId: "asc" },
  });

  const feeds = feedGroups.map((row) => ({
    userId: row.userId,
    count: row._count._all,
  }));

  const feedRows = await prisma.feed.findMany({
    select: { id: true, userId: true, title: true },
    orderBy: [{ userId: "asc" }, { title: "asc" }, { id: "asc" }],
  });

  const articles = await Promise.all(
    feedRows.map(async (feed) => {
      const [total, unread, readLater, starred] = await Promise.all([
        prisma.article.count({
          where: { feedId: feed.id, userId: feed.userId },
        }),
        prisma.article.count({
          where: { feedId: feed.id, userId: feed.userId, readAt: null },
        }),
        prisma.article.count({
          where: { feedId: feed.id, userId: feed.userId, readLater: true },
        }),
        prisma.article.count({
          where: { feedId: feed.id, userId: feed.userId, starred: true },
        }),
      ]);

      return {
        userId: feed.userId,
        feedName: feed.title,
        total,
        unread,
        readLater,
        starred,
      };
    }),
  );

  return { usersTotal, feeds, articles };
};
```

- [ ] **Step 8: Run gauge tests**

Run:

```bash
npm run test -- tests/unit/metrics.test.ts tests/integration/metricsRepository.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit gauge collection and formatting**

Run:

```bash
git add src/lib/metricsFormatter.ts src/lib/metricsRepository.ts tests/unit/metrics.test.ts tests/integration/metricsRepository.test.ts
git commit -m "feat: add prometheus gauge metrics" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds.

## Task 4: Metrics Route

**Files:**

- Create: `src/app/api/metrics/route.ts`
- Create: `tests/integration/metricsRoute.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `tests/integration/metricsRoute.test.ts`:

```ts
import { GET } from "@/app/api/metrics/route";
import { resetMetricsForTests, recordArticleScrape } from "@/lib/metrics";
import { beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

const request = (token?: string) =>
  new Request("http://localhost/api/metrics", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

beforeEach(() => {
  resetMetricsForTests();
  delete process.env.METRICS_TOKEN;
});

describe("GET /api/metrics", () => {
  it("returns 404 when metrics token is not configured", async () => {
    const response = await GET(request());

    expect(response.status).toBe(404);
  });

  it("returns 401 when authorization is missing or wrong", async () => {
    process.env.METRICS_TOKEN = "secret";

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("wrong"))).status).toBe(401);
  });

  it("returns gauge and counter metrics for a valid token", async () => {
    process.env.METRICS_TOKEN = "secret";
    const userId = (await createUser()).id;
    const feed = await createFeed({ userId, title: "Tech Feed" });
    await createArticle({ userId, feedId: feed.id });
    recordArticleScrape({
      userId,
      feedName: "Tech Feed",
      status: "success",
    });

    const response = await GET(request("secret"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; version=0.0.4; charset=utf-8",
    );
    expect(body).toContain("briefing_officer_users_total 1");
    expect(body).toContain(
      `briefing_officer_feeds_total{user_id="${userId}"} 1`,
    );
    expect(body).toContain(
      `briefing_officer_article_scrapes_total{user_id="${userId}",feed_name="Tech Feed",status="success"} 1`,
    );
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
npm run test -- tests/integration/metricsRoute.test.ts
```

Expected: FAIL because `src/app/api/metrics/route.ts` does not exist.

- [ ] **Step 3: Implement metrics route**

Create `src/app/api/metrics/route.ts`:

```ts
import { getMetricsText } from "@/lib/metrics";
import { formatGaugeMetrics } from "@/lib/metricsFormatter";
import { collectGaugeMetrics } from "@/lib/metricsRepository";

const contentType = "text/plain; version=0.0.4; charset=utf-8";

const isAuthorized = (request: Request, token: string) => {
  return request.headers.get("Authorization") === `Bearer ${token}`;
};

export const GET = async (request: Request) => {
  const token = process.env.METRICS_TOKEN;
  if (!token) {
    return new Response("", { status: 404 });
  }

  if (!isAuthorized(request, token)) {
    return new Response("", { status: 401 });
  }

  try {
    const [gaugeMetrics, runtimeMetrics] = await Promise.all([
      collectGaugeMetrics(),
      getMetricsText(),
    ]);

    return new Response(
      `${formatGaugeMetrics(gaugeMetrics)}\n\n${runtimeMetrics}`,
      {
        status: 200,
        headers: { "Content-Type": contentType },
      },
    );
  } catch (error) {
    return new Response("Service Unavailable", { status: 503 });
  }
};
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm run test -- tests/integration/metricsRoute.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit metrics route**

Run:

```bash
git add src/app/api/metrics/route.ts tests/integration/metricsRoute.test.ts
git commit -m "feat: expose prometheus metrics endpoint" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds.

## Task 5: Article Scrape Instrumentation

**Files:**

- Modify: `src/lib/repository/feedRepository.ts`
- Modify: `tests/integration/feedRepository.test.ts`

- [ ] **Step 1: Write failing scrape instrumentation tests**

Add this mock near the other boundary mocks in
`tests/integration/feedRepository.test.ts`:

```ts
vi.mock("@/lib/metrics", () => ({
  recordArticleScrape: vi.fn(),
}));
```

Add this import with the existing imports:

```ts
import { recordArticleScrape } from "@/lib/metrics";
```

Add these tests inside `describe("feedRepository.refreshFeed", () => { ... })`:

```ts
it("records successful article scrape metrics for new articles", async () => {
  const feed = await createFeed({ userId, title: "Tech Feed" });
  vi.mocked(scrapeFeed).mockResolvedValue([
    feedItem("First", "https://example.com/1"),
  ]);

  await refreshFeed(feed.id);

  expect(recordArticleScrape).toHaveBeenCalledWith({
    userId,
    feedName: "Tech Feed",
    status: "success",
  });
});

it("records failed article scrape metrics and continues processing", async () => {
  const feed = await createFeed({ userId, title: "Tech Feed" });
  vi.mocked(scrapeFeed).mockResolvedValue([
    feedItem("First", "https://example.com/1"),
  ]);
  vi.mocked(scrapeArticle).mockRejectedValue(new Error("scrape failed"));

  await refreshFeed(feed.id);

  expect(recordArticleScrape).toHaveBeenCalledWith({
    userId,
    feedName: "Tech Feed",
    status: "error",
  });
  expect(generateAiLead).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run feed repository tests to verify failure**

Run:

```bash
npm run test -- tests/integration/feedRepository.test.ts
```

Expected: FAIL because `recordArticleScrape` is not called.

- [ ] **Step 3: Implement scrape instrumentation**

Modify `src/lib/repository/feedRepository.ts`.

Add import:

```ts
import { recordArticleScrape } from "@/lib/metrics";
```

Change `processArticle`:

```ts
const processArticle = async (article: Article, feedName: string) => {
  try {
    await scrapeArticle(article.id, article.link);
    recordArticleScrape({
      userId: article.userId,
      feedName,
      status: "success",
    });
  } catch (error) {
    recordArticleScrape({
      userId: article.userId,
      feedName,
      status: "error",
    });
    logger.error(
      { article: { id: article.id, title: article.title, link: article.link } },
      "Failed to scrape article.",
    );
  }

  try {
    await generateAiLead(article.id);
  } catch (error) {
    logger.error(
      { article: { id: article.id, title: article.title, link: article.link } },
      "Failed to generate AI lead.",
    );
  }

  revalidatePath(`/feed/${article.feedId}`);
};
```

Change the created articles processing:

```ts
const processedArticles = createdArticles.map((article) =>
  processArticle(article, feed.title),
);
```

- [ ] **Step 4: Run feed repository tests**

Run:

```bash
npm run test -- tests/integration/feedRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit scrape instrumentation**

Run:

```bash
git add src/lib/repository/feedRepository.ts tests/integration/feedRepository.test.ts
git commit -m "feat: record article scrape metrics" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds.

## Task 6: AI Lead and Token Instrumentation

**Files:**

- Modify: `src/lib/ai/services/leadService.ts`
- Modify: `src/lib/ai/services/tokenUsageService.ts`
- Modify: `tests/integration/leadService.test.ts`
- Modify: `tests/integration/tokenUsageService.test.ts`

- [ ] **Step 1: Write failing token usage metrics test**

Add this mock to `tests/integration/tokenUsageService.test.ts`:

```ts
vi.mock("@/lib/metrics", () => ({
  recordLanguageModelTokens: vi.fn(),
}));
```

Update imports:

```ts
import { recordLanguageModelTokens } from "@/lib/metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";
```

Add this assertion to the `"creates a usage row on first call"` test after the
database assertions:

```ts
expect(recordLanguageModelTokens).toHaveBeenCalledWith({
  model: "test-model",
  direction: "input",
  tokens: 10,
});
expect(recordLanguageModelTokens).toHaveBeenCalledWith({
  model: "test-model",
  direction: "output",
  tokens: 5,
});
```

- [ ] **Step 2: Run token usage test to verify failure**

Run:

```bash
npm run test -- tests/integration/tokenUsageService.test.ts
```

Expected: FAIL because `recordLanguageModelTokens` is not called.

- [ ] **Step 3: Implement token instrumentation**

Modify `src/lib/ai/services/tokenUsageService.ts`.

Add import:

```ts
import { recordLanguageModelTokens } from "@/lib/metrics";
```

Add this after the Prisma upsert:

```ts
recordLanguageModelTokens({
  model,
  direction: "input",
  tokens: inputTokens,
});
recordLanguageModelTokens({
  model,
  direction: "output",
  tokens: outputTokens,
});
```

- [ ] **Step 4: Run token usage tests**

Run:

```bash
npm run test -- tests/integration/tokenUsageService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing AI lead outcome tests**

Add this to the metrics mock in `tests/integration/leadService.test.ts`:

```ts
vi.mock("@/lib/metrics", () => ({
  recordAiLeadGeneration: vi.fn(),
}));
```

Add import:

```ts
import { recordAiLeadGeneration } from "@/lib/metrics";
```

Update the `ai` mock so failures can be tested:

```ts
import { generateText } from "ai";
```

Add assertions to the existing success test:

```ts
expect(recordAiLeadGeneration).toHaveBeenCalledWith({
  userId,
  feedName: "Test Feed",
  status: "success",
});
```

Add a failure test:

```ts
it("records failed AI lead generation metrics", async () => {
  const article = await createArticle({ userId, feedId });
  vi.mocked(generateText).mockRejectedValueOnce(new Error("model failed"));

  await expect(generateAiLead(article.id)).rejects.toThrow("model failed");

  expect(recordAiLeadGeneration).toHaveBeenCalledWith({
    userId,
    feedName: "Test Feed",
    status: "error",
  });
});
```

- [ ] **Step 6: Run AI lead tests to verify failure**

Run:

```bash
npm run test -- tests/integration/leadService.test.ts
```

Expected: FAIL because `recordAiLeadGeneration` is not called and the article
query does not include feed title.

- [ ] **Step 7: Implement AI lead outcome instrumentation**

Modify `src/lib/ai/services/leadService.ts`.

Add import:

```ts
import { recordAiLeadGeneration } from "@/lib/metrics";
```

Change article query:

```ts
const article = await prisma.article.findUniqueOrThrow({
  include: { scrape: true, feed: { select: { title: true } } },
  where: { id: articleId },
});
```

Wrap generation/persistence:

```ts
try {
  const lead = await generateText({
    model,
    system: systemPrompt,
    prompt: buildLeadPrompt(article.title, article.scrape?.textContent ?? ""),
  });

  await prisma.articleLead.upsert({
    where: { articleId },
    create: {
      articleId,
      text: lead.text,
    },
    update: {
      text: lead.text,
    },
  });

  recordAiLeadGeneration({
    userId: article.userId,
    feedName: article.feed.title,
    status: "success",
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    lead.totalUsage.inputTokens ?? 0,
    lead.totalUsage.outputTokens ?? 0,
  );

  logger.info(
    {
      articleId,
      feedId: article.feedId,
      model: model.modelId,
      tokenUsage: lead.totalUsage,
    },
    "AI lead generated.",
  );

  return lead.text;
} catch (error) {
  recordAiLeadGeneration({
    userId: article.userId,
    feedName: article.feed.title,
    status: "error",
  });
  throw error;
}
```

- [ ] **Step 8: Run AI lead and token tests**

Run:

```bash
npm run test -- tests/integration/leadService.test.ts tests/integration/tokenUsageService.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit lead and token instrumentation**

Run:

```bash
git add src/lib/ai/services/leadService.ts src/lib/ai/services/tokenUsageService.ts tests/integration/leadService.test.ts tests/integration/tokenUsageService.test.ts
git commit -m "feat: record ai lead and token metrics" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds.

## Task 7: AI Summary Instrumentation

**Files:**

- Modify: `src/lib/ai/services/summaryService.ts`
- Create: `tests/integration/summaryService.test.ts`

- [ ] **Step 1: Write failing AI summary tests**

Create `tests/integration/summaryService.test.ts`:

```ts
import { recordAiSummaryGeneration } from "@/lib/metrics";
import { getUserId } from "@/lib/repository/userRepository";
import { streamText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));

vi.mock("@ai-sdk/rsc", () => ({
  createStreamableValue: vi.fn((initial: string) => ({
    value: initial,
    update: vi.fn(),
    done: vi.fn(),
  })),
}));

vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield "summary";
    })(),
    totalUsage: Promise.resolve({ inputTokens: 11, outputTokens: 4 }),
  })),
}));

vi.mock("@/lib/metrics", () => ({
  recordAiSummaryGeneration: vi.fn(),
}));

vi.mock("@/lib/ai/services/tokenUsageService", () => ({
  trackTokenUsage: vi.fn(),
}));

import { trackTokenUsage } from "@/lib/ai/services/tokenUsageService";
import { streamAiSummary } from "@/lib/ai/services/summaryService";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  feedId = (await createFeed({ userId, title: "Tech Feed" })).id;
});

describe("streamAiSummary", () => {
  it("records successful summary and token metrics", async () => {
    const article = await createArticle({ userId, feedId });

    await streamAiSummary(article.id);
    await vi.waitFor(() => {
      expect(recordAiSummaryGeneration).toHaveBeenCalledWith({
        userId,
        feedName: "Tech Feed",
        status: "success",
      });
    });

    expect(trackTokenUsage).toHaveBeenCalledWith(userId, "test-model", 11, 4);
  });

  it("records failed summary metrics", async () => {
    const article = await createArticle({ userId, feedId });
    vi.mocked(streamText).mockImplementationOnce(() => {
      throw new Error("stream failed");
    });

    await streamAiSummary(article.id);

    await vi.waitFor(() => {
      expect(recordAiSummaryGeneration).toHaveBeenCalledWith({
        userId,
        feedName: "Tech Feed",
        status: "error",
      });
    });
  });
});
```

- [ ] **Step 2: Run summary tests to verify failure**

Run:

```bash
npm run test -- tests/integration/summaryService.test.ts
```

Expected: FAIL because `recordAiSummaryGeneration` is not called and the article
query does not include feed title.

- [ ] **Step 3: Implement AI summary outcome instrumentation**

Modify `src/lib/ai/services/summaryService.ts`.

Add import:

```ts
import { recordAiSummaryGeneration } from "@/lib/metrics";
```

Change article query:

```ts
const article = await prisma.article.findUniqueOrThrow({
  where: { id: articleId, userId },
  include: { scrape: true, feed: { select: { title: true } } },
});
```

Change the background task body:

```ts
void (async () => {
  try {
    const { textStream, totalUsage } = streamText({
      model,
      system: systemPrompt,
      prompt: buildSummaryPrompt(
        article.title,
        article.scrape?.textContent ?? "",
      ),
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();

    const tokenUsage = await totalUsage;

    recordAiSummaryGeneration({
      userId,
      feedName: article.feed.title,
      status: "success",
    });

    logger.info(
      {
        articleId,
        feedId: article.feedId,
        model: model.modelId,
        tokenUsage,
      },
      "AI summary generated.",
    );

    await trackTokenUsage(
      userId,
      model.modelId,
      tokenUsage.inputTokens ?? 0,
      tokenUsage.outputTokens ?? 0,
    );
  } catch (error) {
    recordAiSummaryGeneration({
      userId,
      feedName: article.feed.title,
      status: "error",
    });
    stream.done();
  }
})();
```

- [ ] **Step 4: Run summary tests**

Run:

```bash
npm run test -- tests/integration/summaryService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit summary instrumentation**

Run:

```bash
git add src/lib/ai/services/summaryService.ts tests/integration/summaryService.test.ts
git commit -m "feat: record ai summary metrics" \
  -m "Co-Authored-By: Codex <noreply@openai.com>" \
  -m "Co-Authored-By: GPT-5 <noreply@openai.com>"
```

Expected: commit succeeds.

## Task 8: Final Verification

**Files:**

- Review all modified files.

- [ ] **Step 1: Run focused metrics tests**

Run:

```bash
npm run test -- tests/unit/metrics.test.ts tests/integration/metricsRepository.test.ts tests/integration/metricsRoute.test.ts tests/integration/feedRepository.test.ts tests/integration/leadService.test.ts tests/integration/tokenUsageService.test.ts tests/integration/summaryService.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run required checks**

Run:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git log --oneline origin/main..HEAD
```

Expected: working tree is clean. Commits are Conventional Commits.

- [ ] **Step 4: Push branch and open PR**

Run:

```bash
git push -u origin feat/prometheus-metrics
gh pr create --base main --head feat/prometheus-metrics --title "feat: expose prometheus metrics" --body "## Summary
- expose bearer-token protected Prometheus metrics
- add DB-backed gauge metrics
- add runtime counters for scrape, AI generation, and token usage

## Checks
- npm run format:check
- npm run lint
- npm run test
- npm run build"
```

Expected: PR is created against `main`. Do not merge without explicit user
instruction.

## Self-Review

- Spec coverage: endpoint auth, DB gauges, runtime counters, token naming,
  status labels, type distinction, cardinality, and tests are covered.
- Placeholder scan: no placeholder markers or vague implementation steps are
  present.
- Type consistency: helper names and metric names are consistent across tasks.
