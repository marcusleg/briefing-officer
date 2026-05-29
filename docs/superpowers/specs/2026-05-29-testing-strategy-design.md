# Testing Strategy — Design

**Date:** 2026-05-29
**Status:** Approved (design)

## Problem

Test coverage is poor. The Playwright e2e tests have been disabled (the CI
`e2e-test` job is commented out in `.github/workflows/build-and-test.yaml`) after
breaking for unknown reasons, and there are no unit or integration tests. There
is no test runner installed for anything other than Playwright. Nothing in CI
gates a merge on test results — only `format-check`, `lint`, and `build` run.

## Goal

Establish a testing strategy that gives **refactoring confidence** for the
existing codebase: a fast unit/integration layer that provides quick feedback
when code changes (including Dependabot bumps), with emphasis on the riskiest,
most refactor-prone business logic.

End-to-end testing is **explicitly deferred** to a future phase. This effort
concentrates on the fast feedback layer because it yields the most refactoring
confidence per unit of effort.

## Non-Goals (this phase)

- Reviving or rebuilding the Playwright e2e tests. The existing e2e specs stay
  as-is and the commented-out CI `e2e-test` job stays commented.
- React component rendering tests (server/client components). Large effort,
  lower refactoring-confidence payoff.
- Deep testing of `scraper.ts` internals (live HTTP + JSDOM/Readability). The
  scraper is treated as a mocked boundary rather than exercised directly.
- Chasing a coverage percentage target. Coverage is a visibility tool, not a
  hard gate, at least initially.

## Approach

A two-layer strategy, both layers running under **Vitest**.

### Layer 1 — Unit tests (pure logic, no I/O)

Fast, no database, no network. Covers:

- `src/lib/repository/feedSchema.ts` — the zod schemas:
  - valid feed object passes
  - invalid `link` URL is rejected
  - an invalid regex line in `titleFilterExpressions` is rejected
  - a multi-line `titleFilterExpressions` value where all lines are valid passes
  - `categorySchema` name min (required) and max (100 chars) rules
- Title-filter logic from `feedRepository.refreshFeed` — the regex-based article
  filtering: matching titles are filtered out, non-matching titles are kept, and
  an invalid regex line is ignored (non-fatal). If practical, this logic is
  extracted into a small pure helper so it can be unit-tested directly; otherwise
  it is covered via the integration test for `refreshFeed`.
- `src/lib/utils.ts` and the prompt builders in `src/lib/ai/prompts.ts`.

### Layer 2 — Integration tests (real SQLite, mocked boundaries)

The repositories and AI services are exercised against a **real SQLite
database**, with external/runtime boundaries mocked. This is the high-fidelity
layer that catches real query, constraint, cascade, and persistence bugs that
mock-based tests cannot — which is what refactoring confidence requires.

Covers:

- `feedRepository` — `createFeed`, `updateFeed`, `deleteFeed` (cascades
  articles), `refreshFeed`, `refreshFeeds` / `refreshCategoryFeeds` (skip
  `enabled: false` feeds), and category create/update/delete.
- `articleRepository` — read / mark-as-read / read-later / star operations and
  the `@@unique([userId, feedId, link])` constraint behavior.
- `statsRepository` — aggregation queries return correct shapes from seeded data.
- AI services — `tokenUsageService` (persists and accumulates usage rows),
  `leadService` and `summaryService` (with a mocked LLM, assert correct DB writes
  and token-usage recording).

## Why repositories need boundary mocks

The repositories are Next.js **Server Actions** (`"use server"`) that mix three
concerns. The test harness keeps the database real and mocks the rest:

| Concern               | Examples                                                     | In tests        |
| --------------------- | ------------------------------------------------------------ | --------------- |
| Database access       | `prisma.feed.create`, `prisma.article.deleteMany`            | **Real SQLite** |
| Next.js runtime       | `revalidatePath` (`next/cache`), `redirect` (`next/navigation`) | Mocked       |
| External boundaries   | `getUserId()`, `scrapeFeed`/`scrapeArticle`, `generateAiLead`, global `fetch`, AI SDK | Mocked |

## Test Harness

### Runner & config

- **Vitest.** Add `vitest` and `@vitest/coverage-v8` to devDependencies.
- `vitest.config.ts`:
  - `environment: "node"`
  - path alias `@/` → `src/`
  - `setupFiles: ["vitest.setup.ts"]`
  - `globalSetup` for database provisioning
  - coverage provider `v8`

### Database lifecycle

- **Temp-file SQLite per worker**, e.g. `file:./.tmp/test-<worker>.db`. Chosen
  over in-memory because `prisma db push` against `:memory:` is unreliable across
  Prisma's multiple connections; a temp file is reliable and still fast.
- Schema applied with `prisma db push --skip-generate` against the test
  `DATABASE_URL` during global/worker setup.
- A `resetDb()` helper, called in `beforeEach`, clears all tables in FK-safe order
  to give each test true isolation without transaction-rollback gymnastics.
- A typed **factory module** (`tests/helpers/factories.ts`) provides
  `createUser()`, `createFeed()`, `createArticle()`, `createCategory()` with
  sensible defaults and overrides so tests stay readable.

### Mocks

- **Always-on global stubs** in `vitest.setup.ts`:
  - `next/cache` → `revalidatePath` no-op (asserted where meaningful)
  - `next/navigation` → `redirect` stubbed (it throws in real Next)
  - `logger` → silenced
- **Per-test `vi.mock`** for case-specific boundaries:
  - `@/lib/repository/userRepository` `getUserId()` → returns the seeded test
    user id
  - `@/lib/scraper` (`scrapeFeed`, `scrapeArticle`) → mocked feed items / no-op
  - `@/lib/ai/services/leadService` `generateAiLead` → mocked
  - global `fetch` → mocked (used directly in `createFeed`)
  - the `ai` SDK / provider registry → mocked for `summaryService` /
    `leadService`
- The **Prisma client is not mocked** — it points at the real test DB via
  `DATABASE_URL`.

### Directory layout

```
tests/
  unit/         # Layer 1 — pure logic
  integration/  # Layer 2 — real SQLite + mocked boundaries
  helpers/      # resetDb, factories, shared mock setup
  e2e/          # existing Playwright specs (unchanged this phase)
```

The existing Playwright specs (`frontpage.spec.ts`, `navigation-sidebar.spec.ts`,
`fixtures.ts`) move under `tests/e2e/` for clarity; their content and the
`test:e2e` script are otherwise untouched.

## package.json scripts

- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"test:coverage": "vitest run --coverage"`
- `"test:e2e"` — unchanged.

## CI integration

Add a `test` job to `.github/workflows/build-and-test.yaml`, parallel to
`format-check` / `lint` / `build`:

1. `actions/checkout`
2. `actions/setup-node` (Node 24.x, npm cache)
3. `npm ci`
4. `npx prisma generate`
5. `npm run test` (Vitest provisions its own temp-file DB via `globalSetup`)

This job becomes a **merge gate** — the mechanism that delivers refactoring
confidence. The commented-out `e2e-test` job stays commented (deferred phase).

## Housekeeping

- `.gitignore`: add `.tmp/` (test databases) and `coverage/`.
- Flag (separately, not changed by this work): `shadow.db` is currently untracked
  in the working directory and is likely a Prisma shadow database that should be
  gitignored.

## Rollout (implementation phases)

Each phase lands independently and leaves the suite green.

1. Harness + Vitest config + one trivial passing test (prove the toolchain
   end-to-end).
2. Unit tests (schemas, title-filter) — fast wins that validate the runner.
3. Integration harness (DB lifecycle, factories, boundary mocks) +
   `feedRepository` tests.
4. Remaining repositories (`articleRepository`, `statsRepository`,
   `userRepository`) + AI services.
5. Wire the CI `test` job as a merge gate.

## Success criteria

- `npm run test` runs unit + integration tests locally with fast feedback and a
  watch mode.
- Repositories and AI services are exercised against a real, isolated SQLite
  database per test, with external boundaries mocked.
- The riskiest business logic (feed refresh + filtering, enabled/disabled feed
  handling, cascade deletes, unique constraints, token-usage accounting) has
  regression coverage.
- CI fails the build when a test fails, gating merges.
