# Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Vitest-based unit + integration test layer (real SQLite for
repositories, mocked external/runtime boundaries) that gives refactoring
confidence, and gate merges on it in CI.

**Architecture:** Two layers under one Vitest runner. Layer 1 is pure-logic unit
tests (zod schemas, title filter, prompt builders, `cn`). Layer 2 is integration
tests that run repositories and AI services against a real per-worker temp-file
SQLite database, with `next/cache`, `next/navigation`, and the logger mocked
globally, and per-test mocks for auth (`getUserId`), the scraper, the AI
registry/SDK, and global `fetch`. Schema is applied to each worker's DB once via
`prisma db push`; every test starts from a clean DB via a `resetDb()` helper.

**Tech Stack:** Vitest, `@vitest/coverage-v8`, Prisma (SQLite), Next.js 16
Server Actions, TypeScript (ESM), existing Playwright (untouched).

---

## File Structure

**Created:**

- `vitest.config.ts` — Vitest configuration (node env, `@/` alias, setup file,
  coverage).
- `vitest.setup.ts` — global test bootstrap: sets test `DATABASE_URL`, pushes
  schema once per worker, registers always-on mocks (`next/cache`,
  `next/navigation`, logger), resets the DB before each test.
- `tests/helpers/db.ts` — `resetDb()` table-clearing helper.
- `tests/helpers/factories.ts` — typed row factories (`createUser`,
  `createCategory`, `createFeed`, `createArticle`).
- `src/lib/repository/feedFilter.ts` — pure title-filter helper extracted from
  `refreshFeed`.
- `tests/unit/*.test.ts` — unit tests (sanity, feedSchema, feedFilter, prompts,
  utils).
- `tests/integration/*.test.ts` — integration tests (smoke, feedRepository,
  articleRepository, statsRepository, tokenUsageService, leadService).

**Modified:**

- `package.json` — add devDeps + `test`, `test:watch`, `test:coverage` scripts.
- `.gitignore` — ignore `/.tmp`.
- `src/lib/repository/feedRepository.ts` — use the extracted
  `filterFeedItemsByTitle`.
- `playwright.config.ts` — point `testDir` at `tests/e2e`.
- `.github/workflows/build-and-test.yaml` — add a `test` job.

**Moved:**

- `tests/frontpage.spec.ts`, `tests/navigation-sidebar.spec.ts`,
  `tests/fixtures.ts` → `tests/e2e/` (content unchanged).

---

## Phase 1 — Toolchain

### Task 1: Install Vitest and prove the toolchain

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/unit/sanity.test.ts`

- [ ] **Step 1: Install dev dependencies**

Run:

```bash
npm install -D vitest@^3 @vitest/coverage-v8@^3
```

Expected: both packages added to `devDependencies`, no errors.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Repositories use a shared per-worker SQLite file, so tests within a
    // file must not run concurrently against the same connection.
    fileParallelism: true,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

Note: `setupFiles` references `./vitest.setup.ts`, created in Task 5. Until then
the sanity test below does not depend on it doing anything — create a temporary
empty setup file so the config resolves.

- [ ] **Step 3: Create a temporary empty setup file**

Create `vitest.setup.ts` with a single line (replaced fully in Task 5):

```ts
// Replaced in Task 5 with DB bootstrap + global mocks.
export {};
```

- [ ] **Step 4: Write a trivial passing test**

Create `tests/unit/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Add scripts to package.json**

In `package.json`, add to `"scripts"` (leave `test:e2e` as-is):

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
```

- [ ] **Step 6: Run the test**

Run: `npm run test` Expected: PASS — 1 passed (`tests/unit/sanity.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts tests/unit/sanity.test.ts
git commit -m "test: add vitest toolchain with sanity test"
```

---

## Phase 2 — Unit tests (pure logic)

### Task 2: Unit-test the zod schemas

**Files:**

- Create: `tests/unit/feedSchema.test.ts`
- Reference (do not modify): `src/lib/repository/feedSchema.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/feedSchema.test.ts`:

```ts
import { categorySchema, feedSchema } from "@/lib/repository/feedSchema";
import { describe, expect, it } from "vitest";

const validFeed = {
  title: "Example",
  link: "https://example.com/feed.xml",
  titleFilterExpressions: "",
  enabled: true,
};

describe("feedSchema", () => {
  it("accepts a valid feed", () => {
    expect(feedSchema.safeParse(validFeed).success).toBe(true);
  });

  it("rejects an invalid link URL", () => {
    const result = feedSchema.safeParse({ ...validFeed, link: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid regex in titleFilterExpressions", () => {
    const result = feedSchema.safeParse({
      ...validFeed,
      titleFilterExpressions: "[unclosed",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a multi-line titleFilterExpressions where all lines are valid", () => {
    const result = feedSchema.safeParse({
      ...validFeed,
      titleFilterExpressions: "sport\n^Ad:\nbreaking",
    });
    expect(result.success).toBe(true);
  });
});

describe("categorySchema", () => {
  it("rejects an empty name", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    expect(categorySchema.safeParse({ name: "a".repeat(101) }).success).toBe(
      false,
    );
  });

  it("accepts a valid name", () => {
    expect(categorySchema.safeParse({ name: "News" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npm run test -- tests/unit/feedSchema.test.ts` Expected: PASS — all 7
tests pass (the schema already exists; these characterize current behavior).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/feedSchema.test.ts
git commit -m "test: cover feed and category zod schemas"
```

### Task 3: Extract and unit-test the title filter

The article title-filter logic currently lives inline in
`feedRepository.refreshFeed`. Extract it to a pure, testable helper. The helper
drops the inline `logger.warn`/`logger.debug` calls (they are diagnostics, not
behavior); invalid regex lines are still ignored exactly as before.

**Files:**

- Create: `src/lib/repository/feedFilter.ts`
- Create: `tests/unit/feedFilter.test.ts`
- Modify: `src/lib/repository/feedRepository.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/feedFilter.test.ts`:

```ts
import { filterFeedItemsByTitle } from "@/lib/repository/feedFilter";
import { describe, expect, it } from "vitest";

const items = [
  { title: "Breaking news", link: "a" },
  { title: "Sports roundup", link: "b" },
  { title: "Weather today", link: "c" },
];

describe("filterFeedItemsByTitle", () => {
  it("returns all items when there are no expressions", () => {
    expect(filterFeedItemsByTitle(items, "")).toEqual(items);
  });

  it("removes items whose title matches an expression", () => {
    const result = filterFeedItemsByTitle(items, "Sports");
    expect(result.map((i) => i.link)).toEqual(["a", "c"]);
  });

  it("ignores blank lines between expressions", () => {
    const result = filterFeedItemsByTitle(items, "Sports\n\nWeather");
    expect(result.map((i) => i.link)).toEqual(["a"]);
  });

  it("ignores an invalid regex line and keeps filtering with valid ones", () => {
    const result = filterFeedItemsByTitle(items, "[unclosed\nWeather");
    expect(result.map((i) => i.link)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/unit/feedFilter.test.ts` Expected: FAIL — cannot
import `filterFeedItemsByTitle` (module does not exist).

- [ ] **Step 3: Create the helper**

Create `src/lib/repository/feedFilter.ts`:

```ts
export const filterFeedItemsByTitle = <T extends { title: string }>(
  items: T[],
  titleFilterExpressions: string,
): T[] => {
  const expressions = titleFilterExpressions
    .split("\n")
    .filter((line) => line !== "");

  return items.filter((item) => {
    return !expressions.some((expression) => {
      let regex: RegExp;
      try {
        regex = new RegExp(expression);
      } catch {
        return false; // ignore invalid regex
      }
      return regex.test(item.title);
    });
  });
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/unit/feedFilter.test.ts` Expected: PASS — 4 tests.

- [ ] **Step 5: Use the helper in feedRepository**

In `src/lib/repository/feedRepository.ts`:

Add the import near the other `@/lib/repository` imports:

```ts
import { filterFeedItemsByTitle } from "@/lib/repository/feedFilter";
```

In `refreshFeed`, replace this block:

```ts
const titleFilterExpressions = feed.titleFilterExpressions
  .split("\n")
  .filter((regex) => regex !== "");
const filteredFeedItems = feedItems.filter((item) => {
  let regex: RegExp;
  return !titleFilterExpressions.some((regexString) => {
    try {
      regex = new RegExp(regexString);
    } catch (error) {
      logger.warn(
        {
          article: {
            title: item.title,
            link: item.link,
            publicationDate: item.publicationDate,
          },
          titleFilterExpression: regexString,
        },
        "Invalid title filter expression.",
      );
      return false; // ignore invalid regex
    }
    const test = regex.test(item.title);

    if (test) {
      logger.debug(
        {
          article: {
            title: item.title,
            link: item.link,
            publicationDate: item.publicationDate,
          },
          matchedTitleFilterExpression: regexString,
        },
        "Filtered out article because of title filter.",
      );
    }

    return test;
  });
});
```

with:

```ts
const filteredFeedItems = filterFeedItemsByTitle(
  feedItems,
  feed.titleFilterExpressions,
);
```

- [ ] **Step 6: Verify nothing else broke**

Run: `npm run lint && npx tsc --noEmit` Expected: no errors. (`logger` is still
imported and used elsewhere in the file, so its import stays.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/repository/feedFilter.ts tests/unit/feedFilter.test.ts src/lib/repository/feedRepository.ts
git commit -m "refactor: extract title filter into pure helper and test it"
```

### Task 4: Unit-test prompt builders and `cn`

**Files:**

- Create: `tests/unit/prompts.test.ts`
- Create: `tests/unit/utils.test.ts`

- [ ] **Step 1: Write the prompt builder tests**

Create `tests/unit/prompts.test.ts`:

```ts
import { buildLeadPrompt, buildSummaryPrompt } from "@/lib/ai/prompts";
import { describe, expect, it } from "vitest";

describe("buildLeadPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here");
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("no longer than 80 words");
  });
});

describe("buildSummaryPrompt", () => {
  it("includes the article text and Markdown structure cues", () => {
    const prompt = buildSummaryPrompt("Body text here");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("Executive Summary");
  });
});
```

- [ ] **Step 2: Write the `cn` test**

Create `tests/unit/utils.test.ts`:

```ts
import { cn } from "@/lib/utils";
import { describe, expect, it } from "vitest";

describe("cn", () => {
  it("merges class names and drops falsey values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("lets later tailwind classes win conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
```

- [ ] **Step 3: Run to verify both pass**

Run: `npm run test -- tests/unit/prompts.test.ts tests/unit/utils.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/prompts.test.ts tests/unit/utils.test.ts
git commit -m "test: cover prompt builders and cn helper"
```

---

## Phase 3 — Integration harness + tests

### Task 5: Build the integration test harness

This replaces the placeholder `vitest.setup.ts`. The setup file must set
`DATABASE_URL` to an **absolute** `file:` path **before** anything imports the
Prisma singleton, push the schema once per worker, register the always-on mocks,
and reset the DB before each test.

**Files:**

- Modify: `.gitignore`
- Modify: `vitest.setup.ts` (replace placeholder from Task 1)
- Create: `tests/helpers/db.ts`
- Create: `tests/integration/smoke.test.ts`

- [ ] **Step 1: Ignore the temp DB directory**

In `.gitignore`, under the `# testing` section, add:

```
/.tmp
```

- [ ] **Step 2: Create the resetDb helper**

Create `tests/helpers/db.ts`:

```ts
import prisma from "@/lib/prismaClient";

/**
 * Clears every table in foreign-key-safe order (children before parents).
 * Using prisma.deleteMany avoids depending on physical table names.
 */
export const resetDb = async () => {
  await prisma.articleLead.deleteMany();
  await prisma.articleScrape.deleteMany();
  await prisma.tokenUsage.deleteMany();
  await prisma.article.deleteMany();
  await prisma.feed.deleteMany();
  await prisma.feedCategory.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
};
```

- [ ] **Step 3: Replace vitest.setup.ts with the real bootstrap**

Replace the entire contents of `vitest.setup.ts` with:

```ts
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { resolve } from "path";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

// 1. Point Prisma at a per-worker, absolute SQLite file BEFORE any module
//    imports the Prisma singleton (it reads DATABASE_URL at construction).
const workerId = process.env.VITEST_WORKER_ID ?? "0";
const tmpDir = resolve(process.cwd(), ".tmp");
mkdirSync(tmpDir, { recursive: true });
const dbPath = resolve(tmpDir, `test-${workerId}.db`);
process.env.DATABASE_URL = `file:${dbPath}`;

// 2. Always-on global mocks for Next.js runtime + logger.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // The real redirect throws a special error to halt rendering; tests that
  // assert redirect behavior can spy on this mock instead.
  redirect: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 3. Apply the Prisma schema to this worker's database exactly once.
beforeAll(() => {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "ignore",
  });
});

// 4. Start every test from a clean database.
beforeEach(async () => {
  const { resetDb } = await import("./tests/helpers/db");
  await resetDb();
});

afterEach(() => {
  vi.clearAllMocks();
});
```

Note on the dynamic `import("./tests/helpers/db")`: importing lazily inside
`beforeEach` guarantees `DATABASE_URL` (set synchronously at the top of this
file) is already in place before the Prisma singleton is constructed.

- [ ] **Step 4: Write the smoke integration test**

Create `tests/integration/smoke.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { describe, expect, it } from "vitest";

describe("integration harness", () => {
  it("starts each test with an empty users table", async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it("can write and read a user against the real test DB", async () => {
    await prisma.user.create({
      data: {
        id: "user-1",
        name: "Test",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    expect(await prisma.user.count()).toBe(1);
  });
});
```

- [ ] **Step 5: Ensure the Prisma client is generated, then run**

Run:

```bash
npx prisma generate
npm run test -- tests/integration/smoke.test.ts
```

Expected: PASS — 2 tests. The second test proving isolation: the first test sees
0 users even though the second writes one (order-independent because `resetDb`
runs before each).

- [ ] **Step 6: Run the whole suite to confirm nothing regressed**

Run: `npm run test` Expected: PASS — all unit + integration tests green.

- [ ] **Step 7: Commit**

```bash
git add .gitignore vitest.setup.ts tests/helpers/db.ts tests/integration/smoke.test.ts
git commit -m "test: add integration harness with per-worker sqlite and global mocks"
```

### Task 6: Add typed row factories

**Files:**

- Create: `tests/helpers/factories.ts`
- Create: `tests/integration/factories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/factories.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { describe, expect, it } from "vitest";
import {
  createArticle,
  createCategory,
  createFeed,
  createUser,
} from "../helpers/factories";

describe("factories", () => {
  it("creates a user with sensible defaults", async () => {
    const user = await createUser();
    expect(user.id).toBeTruthy();
    expect(await prisma.user.count()).toBe(1);
  });

  it("creates a feed owned by a user", async () => {
    const user = await createUser();
    const feed = await createFeed({ userId: user.id, title: "My Feed" });
    expect(feed.title).toBe("My Feed");
    expect(feed.enabled).toBe(true);
  });

  it("creates an article on a feed", async () => {
    const user = await createUser();
    const feed = await createFeed({ userId: user.id });
    const article = await createArticle({ userId: user.id, feedId: feed.id });
    expect(article.feedId).toBe(feed.id);
  });

  it("creates a category", async () => {
    const user = await createUser();
    const category = await createCategory({ userId: user.id, name: "Tech" });
    expect(category.name).toBe("Tech");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/integration/factories.test.ts` Expected: FAIL —
cannot import from `../helpers/factories`.

- [ ] **Step 3: Create the factories**

Create `tests/helpers/factories.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { randomUUID } from "crypto";

export const createUser = (
  overrides: Partial<{ id: string; name: string; email: string }> = {},
) => {
  const id = overrides.id ?? randomUUID();
  return prisma.user.create({
    data: {
      id,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const createCategory = (overrides: {
  userId: string;
  name?: string;
}) => {
  return prisma.feedCategory.create({
    data: {
      userId: overrides.userId,
      name: overrides.name ?? "Category",
    },
  });
};

export const createFeed = (overrides: {
  userId: string;
  title?: string;
  link?: string;
  enabled?: boolean;
  titleFilterExpressions?: string;
  feedCategoryId?: number | null;
}) => {
  return prisma.feed.create({
    data: {
      userId: overrides.userId,
      title: overrides.title ?? "Test Feed",
      link: overrides.link ?? `https://example.com/${randomUUID()}.xml`,
      enabled: overrides.enabled ?? true,
      titleFilterExpressions: overrides.titleFilterExpressions ?? "",
      lastFetched: new Date(0),
      feedCategoryId: overrides.feedCategoryId ?? null,
    },
  });
};

export const createArticle = (overrides: {
  userId: string;
  feedId: number;
  title?: string;
  link?: string;
  publicationDate?: Date;
  readAt?: Date | null;
  readLater?: boolean;
  starred?: boolean;
}) => {
  return prisma.article.create({
    data: {
      userId: overrides.userId,
      feedId: overrides.feedId,
      title: overrides.title ?? "Test Article",
      link: overrides.link ?? `https://example.com/article/${randomUUID()}`,
      publicationDate: overrides.publicationDate ?? new Date(),
      readAt: overrides.readAt ?? null,
      readLater: overrides.readLater ?? false,
      starred: overrides.starred ?? false,
    },
  });
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/integration/factories.test.ts` Expected: PASS — 4
tests.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/factories.ts tests/integration/factories.test.ts
git commit -m "test: add typed row factories for integration tests"
```

### Task 7: Integration-test articleRepository

`articleRepository` only depends on Prisma, `getUserId`, `next/cache`, and the
logger. `next/cache` and the logger are already mocked globally; mock
`getUserId` per file.

**Files:**

- Create: `tests/integration/articleRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/articleRepository.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import {
  markArticleAsRead,
  markArticleAsReadLater,
  markArticleAsStarred,
  unmarkArticleAsStarred,
} from "@/lib/repository/articleRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
import { getUserId } from "@/lib/repository/userRepository";

let userId: string;
let feedId: number;

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  const feed = await createFeed({ userId });
  feedId = feed.id;
});

describe("articleRepository", () => {
  it("marks an article as read and clears readLater", async () => {
    const article = await createArticle({ userId, feedId, readLater: true });

    await markArticleAsRead(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.readAt).not.toBeNull();
    expect(updated.readLater).toBe(false);
  });

  it("marks an article as read later", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsReadLater(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.readLater).toBe(true);
  });

  it("stars and unstars an article", async () => {
    const article = await createArticle({ userId, feedId });

    await markArticleAsStarred(article.id);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: article.id } }))
        .starred,
    ).toBe(true);

    await unmarkArticleAsStarred(article.id);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: article.id } }))
        .starred,
    ).toBe(false);
  });

  it("enforces the unique (userId, feedId, link) constraint", async () => {
    await createArticle({ userId, feedId, link: "https://example.com/dup" });
    await expect(
      createArticle({ userId, feedId, link: "https://example.com/dup" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npm run test -- tests/integration/articleRepository.test.ts` Expected:
PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/articleRepository.test.ts
git commit -m "test: cover articleRepository against real sqlite"
```

### Task 8: Integration-test feedRepository

`feedRepository` pulls in many boundaries: `getUserId`, the scraper
(`scrapeFeed`, `scrapeArticle`), `generateAiLead`, `next/navigation` `redirect`,
and global `fetch` (in `createFeed`). Mock all of them. Importing
`@/lib/repository/feedRepository` transitively imports `leadService`, which runs
`await getFirstConfiguredLanguageModel()` at module top-level — so the
`@/lib/ai/services/leadService` mock below is required, not optional.

**Files:**

- Create: `tests/integration/feedRepository.test.ts`

- [ ] **Step 1: Write the failing tests for refresh + enabled filtering**

Create `tests/integration/feedRepository.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import type { Feed } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, createFeed, createUser } from "../helpers/factories";

// --- Boundary mocks (hoisted by Vitest) ---
vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));
vi.mock("@/lib/ai/services/leadService", () => ({
  generateAiLead: vi.fn(),
}));

import { getUserId } from "@/lib/repository/userRepository";
import { scrapeArticle, scrapeFeed } from "@/lib/scraper";
import { generateAiLead } from "@/lib/ai/services/leadService";
import {
  createFeed as createFeedAction,
  deleteFeed,
  refreshFeed,
  refreshFeeds,
  updateFeed,
} from "@/lib/repository/feedRepository";

let userId: string;

const feedItem = (title: string, link: string) => ({
  title,
  link,
  description: null,
  publicationDate: new Date(),
});

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  vi.mocked(scrapeArticle).mockResolvedValue(undefined as never);
  vi.mocked(generateAiLead).mockResolvedValue(undefined as never);
  vi.mocked(scrapeFeed).mockResolvedValue([]);
});

describe("feedRepository.refreshFeed", () => {
  it("creates articles returned by the scraper and updates lastFetched", async () => {
    const feed = await createFeed({ userId });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("First", "https://example.com/1"),
      feedItem("Second", "https://example.com/2"),
    ]);

    await refreshFeed(feed.id);

    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(2);
    const refreshed = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(refreshed.lastFetched.getTime()).toBeGreaterThan(
      new Date(0).getTime(),
    );
  });

  it("does not create articles whose title matches a filter expression", async () => {
    const feed = await createFeed({ userId, titleFilterExpressions: "Sports" });
    vi.mocked(scrapeFeed).mockResolvedValue([
      feedItem("Breaking", "https://example.com/a"),
      feedItem("Sports roundup", "https://example.com/b"),
    ]);

    await refreshFeed(feed.id);

    const titles = (
      await prisma.article.findMany({ where: { feedId: feed.id } })
    ).map((a) => a.title);
    expect(titles).toEqual(["Breaking"]);
  });
});

describe("feedRepository.refreshFeeds", () => {
  it("refreshes only enabled feeds", async () => {
    const enabled = await createFeed({
      userId,
      enabled: true,
      link: "https://example.com/on.xml",
    });
    const disabled = await createFeed({
      userId,
      enabled: false,
      link: "https://example.com/off.xml",
    });
    vi.mocked(scrapeFeed).mockImplementation(async (feed: Feed) => [
      feedItem(`Item for ${feed.id}`, `https://example.com/item-${feed.id}`),
    ]);

    await refreshFeeds();

    expect(await prisma.article.count({ where: { feedId: enabled.id } })).toBe(
      1,
    );
    expect(await prisma.article.count({ where: { feedId: disabled.id } })).toBe(
      0,
    );
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npm run test -- tests/integration/feedRepository.test.ts` Expected: PASS —
3 tests.

- [ ] **Step 3: Add CRUD tests (createFeed, updateFeed, deleteFeed cascade)**

Append to `tests/integration/feedRepository.test.ts`:

```ts
describe("feedRepository.createFeed", () => {
  it("fetches+parses the feed link, creates the row, then refreshes", async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Parsed Title</title></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(scrapeFeed).mockResolvedValue([]);

    await createFeedAction({
      title: "",
      link: "https://example.com/new.xml",
      titleFilterExpressions: "",
      enabled: true,
    });

    const created = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(created.title).toBe("Parsed Title");
    expect(vi.mocked(scrapeFeed)).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("feedRepository.updateFeed", () => {
  it("updates fields and triggers a refresh", async () => {
    const feed = await createFeed({ userId, title: "Old" });
    vi.mocked(scrapeFeed).mockResolvedValue([]);

    await updateFeed(feed.id, {
      title: "New",
      link: feed.link,
      titleFilterExpressions: "",
      enabled: false,
    });

    const updated = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(updated.title).toBe("New");
    expect(updated.enabled).toBe(false);
  });
});

describe("feedRepository.deleteFeed", () => {
  it("deletes the feed and its articles", async () => {
    const feed = await createFeed({ userId });
    await prisma.article.create({
      data: {
        userId,
        feedId: feed.id,
        title: "A",
        link: "https://example.com/x",
        publicationDate: new Date(),
      },
    });

    await deleteFeed(feed.id);

    expect(await prisma.feed.count({ where: { id: feed.id } })).toBe(0);
    expect(await prisma.article.count({ where: { feedId: feed.id } })).toBe(0);
  });
});
```

Note: `deleteFeed` calls `redirect("/")`, which is mocked globally in
`vitest.setup.ts` (a no-op), so it will not throw.

- [ ] **Step 4: Add category CRUD tests**

Append to `tests/integration/feedRepository.test.ts` (extend the existing import
line from `@/lib/repository/feedRepository` to also import these):

```ts
import {
  createCategory as createCategoryAction,
  deleteCategory,
  getUserCategories,
  updateCategory,
} from "@/lib/repository/feedRepository";

describe("feedRepository categories", () => {
  it("creates and lists categories alphabetically", async () => {
    await createCategoryAction({ name: "Zeta" });
    await createCategoryAction({ name: "Alpha" });

    const categories = await getUserCategories();
    expect(categories.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("updates a category name", async () => {
    const category = await createCategory({ userId, name: "Old" });
    await updateCategory(category.id, { name: "Renamed" });
    const updated = await prisma.feedCategory.findUniqueOrThrow({
      where: { id: category.id },
    });
    expect(updated.name).toBe("Renamed");
  });

  it("nulls feeds' category on delete instead of deleting feeds", async () => {
    const category = await createCategory({ userId, name: "Tech" });
    const feed = await createFeed({ userId, feedCategoryId: category.id });

    await deleteCategory(category.id);

    expect(
      await prisma.feedCategory.count({ where: { id: category.id } }),
    ).toBe(0);
    const stillThere = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(stillThere.feedCategoryId).toBeNull();
  });
});
```

- [ ] **Step 5: Run the full feedRepository file**

Run: `npm run test -- tests/integration/feedRepository.test.ts` Expected: PASS —
all tests across the four `describe` groups.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/feedRepository.test.ts
git commit -m "test: cover feedRepository (refresh, enabled filtering, CRUD, categories)"
```

### Task 9: Integration-test statsRepository

**Files:**

- Create: `tests/integration/statsRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/statsRepository.test.ts`:

```ts
import {
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
  getUnreadArticlesPerFeed,
} from "@/lib/repository/statsRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
import { getUserId } from "@/lib/repository/userRepository";

let userId: string;
let feedId: number;

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  feedId = (await createFeed({ userId, title: "Feed A" })).id;
});

describe("statsRepository counts", () => {
  it("counts unread articles (not read, not read-later)", async () => {
    await createArticle({ userId, feedId });
    await createArticle({ userId, feedId, readAt: new Date() });
    await createArticle({ userId, feedId, readLater: true });

    expect(await getNumberOfUnreadArticles()).toBe(1);
  });

  it("counts read-later articles", async () => {
    await createArticle({ userId, feedId, readLater: true });
    await createArticle({ userId, feedId });

    expect(await getNumberOfReadLaterArticles()).toBe(1);
  });

  it("reports unread counts per feed", async () => {
    await createArticle({ userId, feedId });
    await createArticle({ userId, feedId, readAt: new Date() });

    const perFeed = await getUnreadArticlesPerFeed();
    expect(perFeed).toEqual([{ feedTitle: "Feed A", unread: 1 }]);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npm run test -- tests/integration/statsRepository.test.ts` Expected: PASS
— 3 tests.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/statsRepository.test.ts
git commit -m "test: cover statsRepository counts against real sqlite"
```

### Task 10: Integration-test AI services (tokenUsageService + leadService)

`tokenUsageService` only touches Prisma — test it directly against the DB.
`leadService` has a top-level `await getFirstConfiguredLanguageModel()` and
calls `generateText` from `ai`; both must be mocked before import. It writes an
`ArticleLead` and records token usage.

**Files:**

- Create: `tests/integration/tokenUsageService.test.ts`
- Create: `tests/integration/leadService.test.ts`

- [ ] **Step 1: Write the tokenUsageService test**

Create `tests/integration/tokenUsageService.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { trackTokenUsage } from "@/lib/ai/services/tokenUsageService";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../helpers/factories";

let userId: string;

beforeEach(async () => {
  userId = (await createUser()).id;
});

describe("trackTokenUsage", () => {
  it("creates a usage row on first call", async () => {
    await trackTokenUsage(userId, "test-model", 10, 5, 1);

    const rows = await prisma.tokenUsage.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].inputTokens).toBe(10);
    expect(rows[0].outputTokens).toBe(5);
    expect(rows[0].reasoningTokens).toBe(1);
  });

  it("accumulates tokens for the same user/date/model", async () => {
    await trackTokenUsage(userId, "test-model", 10, 5, 1);
    await trackTokenUsage(userId, "test-model", 3, 2, 0);

    const row = await prisma.tokenUsage.findFirstOrThrow({ where: { userId } });
    expect(row.inputTokens).toBe(13);
    expect(row.outputTokens).toBe(7);
    expect(row.reasoningTokens).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tokenUsageService test**

Run: `npm run test -- tests/integration/tokenUsageService.test.ts` Expected:
PASS — 2 tests.

- [ ] **Step 3: Write the leadService test**

Create `tests/integration/leadService.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

// Mock the AI registry's top-level model and the `ai` SDK BEFORE importing the service.
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({
    text: "Generated lead.",
    totalUsage: { inputTokens: 7, outputTokens: 3, reasoningTokens: 0 },
  })),
}));

import { generateAiLead } from "@/lib/ai/services/leadService";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("generateAiLead", () => {
  it("stores the generated lead and records token usage", async () => {
    const article = await createArticle({ userId, feedId });

    const result = await generateAiLead(article.id);

    expect(result).toBe("Generated lead.");
    const lead = await prisma.articleLead.findUniqueOrThrow({
      where: { articleId: article.id },
    });
    expect(lead.text).toBe("Generated lead.");

    const usage = await prisma.tokenUsage.findFirstOrThrow({
      where: { userId },
    });
    expect(usage.inputTokens).toBe(7);
    expect(usage.outputTokens).toBe(3);
  });
});
```

- [ ] **Step 4: Run the leadService test**

Run: `npm run test -- tests/integration/leadService.test.ts` Expected: PASS — 1
test.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/tokenUsageService.test.ts tests/integration/leadService.test.ts
git commit -m "test: cover tokenUsageService and leadService with mocked AI"
```

---

## Phase 4 — e2e relocation + CI gate

### Task 11: Move Playwright specs under tests/e2e

This keeps Layer-2 integration tests and Playwright e2e specs in separate
folders, and stops Playwright from trying to run (or Vitest from picking up)
each other's files. The Vitest `include` from Task 1 already only globs
`tests/unit` and `tests/integration`, so Vitest will not pick up `tests/e2e`.

**Files:**

- Move: `tests/frontpage.spec.ts`, `tests/navigation-sidebar.spec.ts`,
  `tests/fixtures.ts` → `tests/e2e/`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Move the files**

Run:

```bash
mkdir -p tests/e2e
git mv tests/frontpage.spec.ts tests/e2e/frontpage.spec.ts
git mv tests/navigation-sidebar.spec.ts tests/e2e/navigation-sidebar.spec.ts
git mv tests/fixtures.ts tests/e2e/fixtures.ts
```

- [ ] **Step 2: Point Playwright at the new directory**

In `playwright.config.ts`, change:

```ts
  testDir: "./tests",
```

to:

```ts
  testDir: "./tests/e2e",
```

- [ ] **Step 3: Verify the relative import inside navigation-sidebar still
      resolves**

`tests/e2e/navigation-sidebar.spec.ts` imports `./fixtures` — `fixtures.ts`
moved into the same `tests/e2e/` folder, so the relative path is unchanged.
Confirm:

Run: `npx playwright test --list` Expected: lists the specs from `tests/e2e/`
without import errors. (The e2e tests remain disabled in CI; this only confirms
discovery/imports.)

- [ ] **Step 4: Confirm Vitest still ignores e2e**

Run: `npm run test` Expected: PASS — Vitest runs only `tests/unit` +
`tests/integration`; no `.spec.ts` e2e files are collected.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e playwright.config.ts
git commit -m "test: relocate playwright specs to tests/e2e"
```

### Task 12: Add the CI test job as a merge gate

**Files:**

- Modify: `.github/workflows/build-and-test.yaml`

- [ ] **Step 1: Add the test job**

In `.github/workflows/build-and-test.yaml`, add this job alongside
`format-check`, `lint`, and `build` (insert after the `lint` job, before
`build`):

```yaml
test:
  runs-on: ubuntu-latest

  steps:
    - uses: actions/checkout@v6
    - name: Use Node.js
      uses: actions/setup-node@v6
      with:
        node-version: "24.x"
        cache: "npm"
    - name: Install Dependencies
      run: npm ci
    - name: Generate Prisma Client
      run: npx prisma generate
    - name: Run Unit and Integration Tests
      run: npm run test
```

Note: `npm run test` (Vitest) provisions its own per-worker SQLite file via
`vitest.setup.ts` and runs `prisma db push`, so no `DATABASE_URL` env or
migration step is needed in this job.

- [ ] **Step 2: Validate the workflow YAML locally**

Run:

```bash
npx --yes js-yaml .github/workflows/build-and-test.yaml > /dev/null && echo "YAML OK"
```

Expected: prints `YAML OK` (the file parses).

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/build-and-test.yaml
git commit -m "ci: run vitest unit and integration tests on push"
git push
```

- [ ] **Step 4: Confirm the job runs green on CI**

After pushing, check the Actions run for this branch:

```bash
gh run list --branch feat/enable-disable-feed --limit 1
gh run watch
```

Expected: the `test` job completes successfully.

---

## Self-Review Notes

- **Spec coverage:** Layer 1 unit (feedSchema → Task 2; title filter → Task 3;
  prompts/utils → Task 4). Layer 2 integration harness (Task 5), factories (Task
  6), feedRepository incl. enabled-feed filtering + cascade (Task 8),
  articleRepository incl. unique constraint (Task 7), statsRepository (Task 9),
  tokenUsageService + leadService with mocked LLM (Task 10). Harness specifics:
  per-worker temp-file SQLite, `prisma db push`, `resetDb` in `beforeEach`,
  global mocks for `next/cache`/`next/navigation`/logger, per-test mocks for
  `getUserId`/scraper/AI/`fetch` (Task 5, applied throughout). Directory layout
  `tests/unit|integration|helpers|e2e` (Tasks 1–11). Scripts + devDeps (Task 1).
  `.gitignore` `/.tmp` (Task 5); `/coverage` is already ignored. CI merge gate
  (Task 12). e2e deferred and relocated, not revived (Task 11).
- **`summaryService` not directly tested:** it returns a streamable RSC value
  via `createStreamableValue` and does its DB write in a fire-and-forget async
  IIFE, which is awkward to assert deterministically; `leadService` covers the
  same generate→persist→track-usage path synchronously. Documented here as an
  intentional omission consistent with the spec's "representative coverage, not
  100%."
- **`shadow.db`:** untracked file flagged in the spec; not touched by this plan.
- **Behavior change:** Task 3 drops two diagnostic `logger` calls when
  extracting the title filter; filtering behavior is unchanged and covered by
  tests.
