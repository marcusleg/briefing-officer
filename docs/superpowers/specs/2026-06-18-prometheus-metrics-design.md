# Design: Prometheus metrics endpoint

**Date:** 2026-06-18

## Goal

Expose Prometheus-compatible metrics for operational monitoring. The endpoint
must support both runtime counters and database-backed gauges, use Prometheus
metric naming conventions, and require a bearer token configured through the
environment.

## Endpoint

Add `GET /api/metrics`.

Behavior:

1. If `METRICS_TOKEN` is not configured, return `404`.
2. If `METRICS_TOKEN` is configured but the request does not include
   `Authorization: Bearer <token>`, return `401`.
3. If the token matches, return Prometheus text exposition with
   `Content-Type: text/plain; version=0.0.4; charset=utf-8`.
4. If gauge collection fails, return `503` rather than partial metrics.

The route is intentionally not tied to the app's Better Auth session. Prometheus
scrapes authenticate with the metrics token only.

## Metric Types

The feature exposes two kinds of metrics:

- **Gauges** represent current application state read from the database at
  scrape time. They can go up or down between scrapes.
- **Counters** represent runtime events recorded while the server process is
  running. They only increase until the process restarts.

This distinction is part of the metric contract and should be reflected in tests
and `HELP`/`TYPE` output.

## Metric Names

Names follow the Prometheus naming recommendations:

- Use the application prefix `briefing_officer`.
- Use `_total` for counters.
- Use labels for dimensions instead of baking dimensions into metric names.
- Keep each metric to one logical quantity and one unit.
- Use base units where applicable.

### Gauges

Database-backed gauges:

```text
briefing_officer_users_total
briefing_officer_feeds_total{user_id}
briefing_officer_articles_total{user_id,feed_name}
briefing_officer_articles_unread_total{user_id,feed_name}
briefing_officer_articles_read_later_total{user_id,feed_name}
briefing_officer_articles_starred_total{user_id,feed_name}
```

Although these names end in `_total`, they are gauges because they describe
current totals that can decrease when feeds or articles are deleted or when
article state changes.

### Counters

Runtime counters:

```text
briefing_officer_article_scrapes_total{user_id,feed_name,status="success|error"}
briefing_officer_ai_lead_generations_total{user_id,feed_name,status="success|error"}
briefing_officer_ai_summary_generations_total{user_id,feed_name,status="success|error"}
briefing_officer_language_model_tokens_total{model,direction="input|output"}
```

Use `status="error"` rather than `fail` or `failure`; it is concise and pairs
well with `success`. The scrape, AI lead, and AI summary counters describe
operation outcomes, so both success and error attempts are represented by the
same metric family.

`briefing_officer_language_model_tokens_total` combines input and output token
counts in one metric because both labels represent the same logical quantity and
unit: tokens. The `direction` label differentiates the characteristic of the
tokens. The name uses `language_model` instead of the `llm` acronym so the
published metric remains explicit.

## Components

### `src/lib/metrics.ts`

Owns the Prometheus registry, metric definitions, and recording helpers.

Responsibilities:

1. Create a Prometheus registry for runtime counters. Production does not need
   counter values to survive development hot reloads.
2. Define all runtime counters with the agreed names and labels.
3. Expose helper functions:
   - `recordArticleScrape({ userId, feedName, status })`
   - `recordAiLeadGeneration({ userId, feedName, status })`
   - `recordAiSummaryGeneration({ userId, feedName, status })`
   - `recordLanguageModelTokens({ model, direction, tokens })`
4. Expose a function to render runtime metrics from the registry.
5. Keep label values as plain strings and let the Prometheus client handle
   exposition escaping.

### `src/lib/metricsRepository.ts`

Collects database-backed gauge values at scrape time.

Responsibilities:

1. Count users globally.
2. Count feeds per user.
3. Count all articles per user and feed.
4. Count unread articles per user and feed.
5. Count read-later articles per user and feed.
6. Count starred articles per user and feed.
7. Return rows in a stable order so output is deterministic in tests.

The repository should not use session-scoped dashboard helpers because metrics
are global operational data.

### `src/lib/metricsFormatter.ts`

Serializes database-backed gauge rows to Prometheus text exposition.

Responsibilities:

1. Emit `HELP` and `TYPE` lines for every gauge metric.
2. Escape label names and values according to Prometheus text exposition rules.
3. Keep rendering deterministic.

The runtime counters can use the Prometheus client formatter directly; the gauge
formatter covers scrape-time DB values that are not stored in the runtime
registry.

### `src/app/api/metrics/route.ts`

Handles HTTP behavior only:

1. Check whether metrics are enabled by reading `METRICS_TOKEN`.
2. Validate `Authorization: Bearer <token>`.
3. Collect DB gauges.
4. Render gauges plus runtime counters into one response body.
5. Return the correct status and content type.

## Instrumentation Points

### Feed refresh and article scraping

`refreshFeed` already knows the feed id, feed title, user id, and newly created
articles. Increment `briefing_officer_article_scrapes_total` once for each
article scrape attempt:

- `status="success"` after `scrapeArticle` succeeds.
- `status="error"` when `scrapeArticle` throws.

### AI lead generation

`generateAiLead` loads the article and knows the user id, feed id, and model.
Include feed title in the article query or load it separately. Increment
`briefing_officer_ai_lead_generations_total`:

- `status="success"` after the lead is saved.
- `status="error"` when generation or persistence throws after the article and
  feed context is known.

Also record input and output tokens through
`briefing_officer_language_model_tokens_total` after successful generation.

### AI summary generation

`streamAiSummary` knows the user id, article, feed, and model. Increment
`briefing_officer_ai_summary_generations_total`:

- `status="success"` after the stream completes and usage is available.
- `status="error"` when the streaming task throws after article and feed context
  is known.

Also record input and output tokens through
`briefing_officer_language_model_tokens_total` after successful generation.

## Error Handling

- Metrics recording must not break product workflows. Recording helper failures
  should be avoided by construction and should not throw for normal label/value
  input.
- Existing scrape and AI errors should continue to follow current application
  behavior.
- `/api/metrics` should fail closed: no token means no endpoint, and scrape-time
  database errors return `503`.

## Cardinality and Privacy

The agreed labels include `user_id` and `feed_name`. These are useful for
operational breakdowns, but they are high-cardinality and can expose identifiers
to Prometheus. This is intentional for the first version and should be called
out in release notes or deployment docs.

## Testing

Use Vitest with test-first implementation.

Unit tests:

1. Metrics helpers increment counters with the expected names and labels.
2. Gauge formatter emits valid `HELP`, `TYPE`, labels, and values.
3. Label values are escaped correctly.

Integration or route tests:

1. `GET /api/metrics` returns `404` when `METRICS_TOKEN` is missing.
2. `GET /api/metrics` returns `401` for missing or wrong bearer token.
3. `GET /api/metrics` returns Prometheus text and content type for a valid
   token.
4. Gauge values reflect seeded feed and article state.

Service tests:

1. Article scrape success and error paths increment the scrape counter.
2. AI lead success and error paths increment the lead counter.
3. AI summary success and error paths increment the summary counter.
4. Token usage records input and output token counters by model.

## Out of Scope

- Creating or managing `ServiceMonitor` manifests in the Helm chart.
- Adding process, Node.js, HTTP request, or default runtime metrics.
- Persisting runtime counters to SQLite.
- Adding per-request metrics middleware.
