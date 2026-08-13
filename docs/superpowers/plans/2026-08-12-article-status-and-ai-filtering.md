# Article Status and AI Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Article.readAt` / `Article.readLater` with a single `status`
column, and use it to hold two new states for articles that do not belong in the
inbox — `FILTERED` (a language model judged it irrelevant against the feed's
interest profile) and `NOT_INTERESTED` (the reader said so by hand).

**Architecture:** The schema change lands in three steps rather than one so the
tree stays green throughout. Task 1 adds the new columns and writes them
alongside the legacy pair; Task 2 switches every read over and drops the mirror
writes; Task 3 removes the legacy columns. The filtering feature then stacks on
top: Task 4 replaces the regex filter with a per-feed interest profile, Task 5
asks the model for a verdict inside the lead call that already runs, and Task 6
adds the review view and the rejection action.

**Tech Stack:** Next.js App Router (server components + server actions), Prisma
7.9.1 on SQLite via `@prisma/adapter-better-sqlite3`, Vercel AI SDK
(`generateObject`), Vitest (projects `node` and `components`), Playwright,
Tailwind + shadcn/ui.

**Spec:**
`docs/superpowers/specs/2026-08-12-article-status-and-ai-filtering-design.md`

## Global Constraints

- Conventional Commits **without scopes**. `feat:` and `fix:` land in the public
  changelog, so word their first line for end users.
- Never bypass the Husky hook with `git commit --no-verify`.
- Run `npm run format` before committing; `proseWrap` is `always`, so Markdown
  reflows too.
- CI gates on all of: `npm run format:check`, `npm run lint`,
  `npm run typecheck`, `npm run test`, `npm run build`.
- Work on a branch named `feat/article-status-and-ai-filtering`. Do not push to
  `main`.
- `statusChangedAt` is a plain `DateTime @default(now())` — **never**
  `@updatedAt`.
- Enum member spelling is exactly `UNREAD`, `READ_LATER`, `FILTERED`,
  `NOT_INTERESTED`, `READ`.
- The `show` query-parameter values are exactly `all`, `unread`, `rejected`.
- UI copy is fixed: the dropdown is labelled **View**, its third option is **Not
  interested**, the feed-form field is **Interest Profile**, and the
  hand-rejection tooltip is **Not interested**. `DismissButton` keeps its
  existing **Dismiss** / **Restore** labels unchanged.

## Two things to know before starting

**Tests never exercise the migrations.** `vitest.setup.ts:39` runs
`prisma db push --accept-data-loss` against a per-worker SQLite file. It builds
the schema from `schema.prisma` directly, so a broken backfill in a migration
will not fail a single test. Tasks 1, 3, and 4 each carry an explicit manual
verification step against a dev database. Do not skip them.

**Prisma enums work on SQLite here — confirmed.** 7.9.1 emits
`"status" TEXT NOT NULL DEFAULT 'UNREAD'` for an enum column. Task 1 Step 1
re-verifies it and Step 2 keeps the string-union fallback documented, but the
native enum is the expected path.

**Every test command needs a Prisma consent prefix.** Prisma 7.9.1 refuses
`prisma db push` when it detects an AI agent, and `vitest.setup.ts:39` runs it
on every test run. The user consented on 2026-08-13, so run tests as:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npm run test
```

Do not persist that variable into `.env`, `package.json`, `vitest.setup.ts`, or
`.claude/settings*.json`. It belongs on the command line only. The consent
covers the ephemeral `.tmp/test-<worker>.db` files and nothing else.

## File Structure

| File                                               | Responsibility                                                                         | Task  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ----- |
| `prisma/schema.prisma`                             | `ArticleStatus`, `Article.status/statusChangedAt/filterReason`, `Feed.interestProfile` | 1,3,4 |
| `prisma/migrations/*/migration.sql`                | three migrations: add status, drop legacy pair, swap feed filter field                 | 1,3,4 |
| `src/lib/repository/articleRepository.ts`          | the sole writers of `status`, plus every status-changing server action                 | 1,2,6 |
| `src/lib/repository/statsRepository.ts`            | dashboard counts and charts                                                            | 2     |
| `src/lib/repository/feedRepository.ts`             | feed refresh; loses its filtering step                                                 | 4     |
| `src/lib/repository/feedSchema.ts`                 | feed form validation                                                                   | 4     |
| `src/lib/repository/feedFilter.ts`                 | **deleted**                                                                            | 4     |
| `src/lib/ai/prompts.ts`                            | `buildLeadPrompt` gains the interest profile                                           | 5     |
| `src/lib/ai/services/leadService.ts`               | the relevance verdict, written with the lead                                           | 5     |
| `src/components/article/dismiss-button.tsx`        | Dismiss/Restore, and correct Undo                                                      | 2,6   |
| `src/components/article/not-interested-button.tsx` | **new** — the hand-rejection icon action                                               | 6     |
| `src/components/article/article-card.tsx`          | `m` hotkey, read dimming, `filterReason` display                                       | 2,6   |
| `src/app/feed/[feedId]/feed-view-button.tsx`       | **renamed** from `feed-filter-button.tsx`; the third view                              | 6     |
| `prisma/seed.ts`                                   | seeds all five statuses for screenshots                                                | 3,6   |

---

### Task 1: Add the status column alongside the legacy pair

The new columns are added and kept correct, but nothing reads them yet. Writes
go through a single chokepoint that sets both the new column and the old pair,
so the application keeps working off `readAt`/`readLater` and the tree stays
green.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_article_status/migration.sql`
- Modify: `src/lib/repository/articleRepository.ts`
- Modify: `tests/helpers/factories.ts:53-75`
- Modify: `tests/integration/articleRepository.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `ArticleStatus` — enum (or string union) exported from
    `@/generated/prisma/client`, members
    `UNREAD | READ_LATER | FILTERED | NOT_INTERESTED | READ`.
  - `Article.status: ArticleStatus`, `Article.statusChangedAt: Date`,
    `Article.filterReason: string | null`.
  - `createArticle(overrides)` in `tests/helpers/factories.ts` accepts
    `status?: ArticleStatus` and `statusChangedAt?: Date`.

- [ ] **Step 1: Settle whether Prisma emits usable DDL for a SQLite enum**

```bash
git checkout -b feat/article-status-and-ai-filtering
npm install
mkdir -p /tmp/enumcheck && cat > /tmp/enumcheck/mini.prisma <<'EOF'
datasource db {
  provider = "sqlite"
}

enum ArticleStatus {
  UNREAD
  READ_LATER
  FILTERED
  NOT_INTERESTED
  READ
}

model Probe {
  id     Int           @id @default(autoincrement())
  status ArticleStatus @default(UNREAD)
}
EOF
DATABASE_URL="file:/tmp/enumcheck/mini.db" npx prisma migrate diff \
  --from-empty --to-schema /tmp/enumcheck/mini.prisma --script
```

Two things about this probe schema are load-bearing, both learned the hard way:
each enum value needs **its own line** (a single-line body is a parse error),
and the `datasource` block must **not** carry an inline `url` — this project is
on Prisma 7 with `prisma.config.ts` supplying it, and an inline `url` is
rejected outright. Get either wrong and the command fails for reasons that have
nothing to do with enum support, which reads as "enums don't work".

Expected: SQL containing `CREATE TABLE "Probe"` with a
`"status" TEXT NOT NULL DEFAULT 'UNREAD'` column. If you get that, use a native
enum in Step 2.

If the command errors or prints nothing, use the string-union fallback in Step 2
instead. Both are acceptable; record which one you used in the commit body.

- [ ] **Step 2: Add the new fields to the schema**

In `prisma/schema.prisma`, add above `model Feed`:

```prisma
enum ArticleStatus {
  UNREAD
  READ_LATER
  FILTERED
  NOT_INTERESTED
  READ
}
```

In `model Article`, immediately after the `starred` line, add:

```prisma
status          ArticleStatus @default(UNREAD)
statusChangedAt DateTime      @default(now())
filterReason    String?
```

Leave `readAt` and `readLater` in place — they are removed in Task 3.

**Fallback if Step 1 said enums do not work:** omit the `enum` block and use
`status String @default("UNREAD")`, then add
`export type ArticleStatus = "UNREAD" | "READ_LATER" | "FILTERED" | "NOT_INTERESTED" | "READ";`
to `src/lib/constants.ts` and import it wherever this plan imports
`ArticleStatus` from `@/generated/prisma/client`.

- [ ] **Step 3: Generate the migration without applying it**

```bash
npx prisma migrate dev --create-only --name add_article_status
```

Expected: a new directory under `prisma/migrations/` containing `migration.sql`.
Because `statusChangedAt` defaults to `now()` and SQLite forbids
`DEFAULT CURRENT_TIMESTAMP` in `ALTER TABLE ADD COLUMN`, Prisma will emit a
`-- RedefineTables` block that rebuilds `Article` — the same shape as
`prisma/migrations/20250812222535_drop_html_content_field_from_articlescrape_table/migration.sql`.

- [ ] **Step 4: Edit the migration so it backfills instead of defaulting**

The generated `INSERT INTO "new_Article" (...) SELECT ... FROM "Article";`
copies only the pre-existing columns, leaving every row at `status = 'UNREAD'`.
Replace that single `INSERT` statement with the one below. Leave the surrounding
`CREATE TABLE`, `DROP TABLE`, `ALTER TABLE ... RENAME`, index creation, and
`PRAGMA` lines exactly as Prisma generated them.

```sql
INSERT INTO "new_Article" (
    "id", "title", "publicationDate", "description", "content", "author",
    "language", "link", "commentsLink", "readAt", "readLater", "starred",
    "createdAt", "updatedAt", "feedId", "userId",
    "status", "statusChangedAt", "filterReason"
)
SELECT
    "id", "title", "publicationDate", "description", "content", "author",
    "language", "link", "commentsLink", "readAt", "readLater", "starred",
    "createdAt", "updatedAt", "feedId", "userId",
    -- readLater wins over readAt: the only way to hold both is read, then
    -- deliberately marked read-later, so READ_LATER is the latest intent.
    CASE WHEN "readLater" THEN 'READ_LATER'
         WHEN "readAt" IS NOT NULL THEN 'READ'
         ELSE 'UNREAD' END,
    CASE WHEN "readLater" THEN "updatedAt"
         WHEN "readAt" IS NOT NULL THEN "readAt"
         ELSE "createdAt" END,
    NULL
FROM "Article";
```

- [ ] **Step 5: Apply it and confirm the schema matches**

```bash
npx prisma migrate dev
npx prisma generate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Expected: the migration applies, and the final command exits `0` with "no
difference". A non-zero exit means the edited `CREATE TABLE` drifted from the
schema — fix the migration, do not hand-edit the database.

- [ ] **Step 6: Verify the backfill on real rows**

The test suite uses `prisma db push` and will never run this migration, so check
it by hand against the dev database:

```bash
npx prisma db execute --url "file:./data/dev.db" --stdin <<'EOF'
SELECT status, COUNT(*) AS n,
       SUM(CASE WHEN statusChangedAt IS NULL THEN 1 ELSE 0 END) AS null_timestamps
FROM Article GROUP BY status;
EOF
```

Expected: rows only for `UNREAD`, `READ`, and `READ_LATER`, with
`null_timestamps` zero for every group. If `data/dev.db` does not exist, run
`npx prisma db seed` first and re-run Step 5 against it.

- [ ] **Step 7: Teach the article factory about status**

In `tests/helpers/factories.ts`, change `createArticle` (lines 53-75) to:

```ts
export const createArticle = (overrides: {
  userId: string;
  feedId: number;
  title?: string;
  link?: string;
  publicationDate?: Date;
  readAt?: Date | null;
  readLater?: boolean;
  starred?: boolean;
  status?: ArticleStatus;
  statusChangedAt?: Date;
  filterReason?: string | null;
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
      status: overrides.status ?? "UNREAD",
      statusChangedAt: overrides.statusChangedAt ?? new Date(),
      filterReason: overrides.filterReason ?? null,
    },
  });
};
```

Add the import at the top of the file:

```ts
import { ArticleStatus } from "@/generated/prisma/client";
```

- [ ] **Step 8: Write the failing tests for the chokepoint**

Replace the first two cases in `tests/integration/articleRepository.test.ts`
(lines 28-49) with these four:

```ts
it("marks an article as read", async () => {
  const article = await createArticle({ userId, feedId, status: "READ_LATER" });

  await markArticleAsRead(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });
  expect(updated.status).toBe("READ");
  expect(updated.readAt).not.toBeNull();
  expect(updated.readLater).toBe(false);
});

it("marks an article as read later", async () => {
  const article = await createArticle({ userId, feedId });

  await markArticleAsReadLater(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });
  expect(updated.status).toBe("READ_LATER");
  expect(updated.readLater).toBe(true);
});

it("returns an article to the inbox", async () => {
  const article = await createArticle({ userId, feedId, status: "READ" });

  await unmarkArticleAsRead(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });
  expect(updated.status).toBe("UNREAD");
  expect(updated.readAt).toBeNull();
});

it("moves statusChangedAt forward on every status change", async () => {
  const longAgo = new Date("2020-01-01T00:00:00.000Z");
  const article = await createArticle({
    userId,
    feedId,
    statusChangedAt: longAgo,
  });

  await markArticleAsRead(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });
  expect(updated.statusChangedAt.getTime()).toBeGreaterThan(longAgo.getTime());
});
```

Add `unmarkArticleAsRead` to the import list at the top of the file.

- [ ] **Step 9: Run the tests to verify they fail**

```bash
npx vitest run --project node tests/integration/articleRepository.test.ts
```

Expected: FAIL — the three status assertions report `'UNREAD'` where `'READ'`,
`'READ_LATER'`, and `'UNREAD'` are expected, and `statusChangedAt` is unmoved.

- [ ] **Step 10: Add the chokepoint and route every status write through it**

In `src/lib/repository/articleRepository.ts`, add after the imports:

```ts
/**
 * Temporary. `readAt` and `readLater` are still what the application reads
 * until Task 2, so every status write mirrors into them. Deleted in Task 2 once
 * nothing reads them.
 */
const legacyMirror = (status: ArticleStatus) => ({
  readAt: status === "READ" ? new Date() : null,
  readLater: status === "READ_LATER",
});

/**
 * The only writers of `status` and `statusChangedAt`. Pairing the two writes
 * here is what lets History treat `statusChangedAt` as the read timestamp: for
 * a READ article it is, by construction, the moment it became read. Anything
 * that writes one without the other breaks that.
 */
const setArticleStatus = (articleId: number, status: ArticleStatus) =>
  prisma.article.update({
    where: { id: articleId },
    data: { status, statusChangedAt: new Date(), ...legacyMirror(status) },
  });

const setArticleStatusMany = (
  where: Prisma.ArticleWhereInput,
  status: ArticleStatus,
) =>
  prisma.article.updateMany({
    where,
    data: { status, statusChangedAt: new Date(), ...legacyMirror(status) },
  });
```

Add to the imports:

```ts
import { ArticleStatus, Prisma } from "@/generated/prisma/client";
```

Now rewrite the five status-changing functions to use it, keeping every existing
`revalidatePath` call exactly as it is. `markArticleAsRead` becomes:

```ts
export const markArticleAsRead = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "READ");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};
```

Apply the same shape to `markArticleAsReadLater` (`"READ_LATER"`),
`unmarkArticleAsRead` (`"UNREAD"`), and `unmarkArticleAsReadLater` (`"UNREAD"`).

`markArticlesOlderThanXDaysAsRead` and
`markCategoryArticlesOlderThanXDaysAsRead` keep their `where` clauses unchanged
for now and swap their `prisma.article.updateMany` for
`setArticleStatusMany(where, "READ")`, still returning `count`.

Leave `markArticleAsStarred`, `unmarkArticleAsStarred`, and
`deleteArticlesOlderThanXDays` untouched — `starred` is not a status.

Note one deliberate behaviour change: `unmarkArticleAsReadLater` now lands on
`UNREAD` rather than leaving a stale `readAt` behind. That is the design — the
`READ` state was already lost when the article became `READ_LATER`.

- [ ] **Step 11: Run the tests to verify they pass**

```bash
npx vitest run --project node tests/integration/articleRepository.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 12: Keep the seed consistent with the new column**

`prisma/seed.ts` sets `readAt` on its already-read articles (line 275) but knows
nothing about `status`, so seeded read articles would land as `UNREAD` and
vanish from History the moment Task 2 switches the query over. Add both fields
now, beside the existing `readAt`:

```ts
          readAt,
          status: "READ",
          statusChangedAt: readAt,
```

Task 3 removes the `readAt` line once the column is gone.

- [ ] **Step 13: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run format
git add prisma src tests
git commit -m "refactor: add an article status column alongside the read flags"
```

---

### Task 2: Read from the status column

Every query and component switches to `status`, and the mirror writes go away.
This is the task where the two miscounting bugs get fixed and where History's
sort key changes.

**Files:**

- Modify: `src/lib/repository/articleRepository.ts`
- Modify: `src/lib/repository/statsRepository.ts:16,26,39,121`
- Modify: `src/app/feed/page.tsx:40`
- Modify: `src/app/feed/[feedId]/page.tsx:42`
- Modify: `src/app/feed/category/[categoryId]/page.tsx:43`
- Modify: `src/app/feed/history/page.tsx:22,28`
- Modify: `src/app/feed/read-later/page.tsx:23`
- Modify: `src/app/feed/no-unread-articles.tsx:18`
- Modify: `src/app/feed/[feedId]/no-unread-articles.tsx:23`
- Modify: `src/components/navigation/feed-navigation.tsx:27,42`
- Modify: `src/components/article/article-card.tsx:79,110`
- Modify: `src/components/article/dismiss-button.tsx:46`
- Modify: `src/components/article/toggle-read-later-button.tsx:55,62,67`
- Modify: `tests/integration/statsRepository.test.ts`
- Modify: `tests/integration/articleRepository.test.ts`
- Modify: `tests/components/article/dismiss-button.test.tsx`
- Modify: `tests/components/article/article-card-actions.test.tsx:24-26`

**Interfaces:**

- Consumes: `ArticleStatus`, `Article.status`, `Article.statusChangedAt`, and
  the `createArticle({ status })` factory override from Task 1.
- Produces: no new exports. After this task nothing in `src/` or `tests/` reads
  `readAt` or `readLater`, which is what makes Task 3 a pure deletion.

- [ ] **Step 1: Write the failing test for History ordering**

This is the behaviour the design promises and the one most likely to regress.
Add to `tests/integration/articleRepository.test.ts`:

```ts
it("orders read articles most-recently-read first", async () => {
  const oldest = await createArticle({
    userId,
    feedId,
    status: "READ",
    statusChangedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const newest = await createArticle({
    userId,
    feedId,
    status: "READ",
    statusChangedAt: new Date("2026-03-01T00:00:00.000Z"),
  });
  const middle = await createArticle({
    userId,
    feedId,
    status: "READ",
    statusChangedAt: new Date("2026-02-01T00:00:00.000Z"),
  });
  await createArticle({ userId, feedId, status: "UNREAD" });
  await createArticle({ userId, feedId, status: "READ_LATER" });

  const history = await prisma.article.findMany({
    where: { status: "READ", userId },
    orderBy: { statusChangedAt: "desc" },
  });

  expect(history.map((a) => a.id)).toEqual([newest.id, middle.id, oldest.id]);
});

it("does not move statusChangedAt when only starred changes", async () => {
  const readAtTime = new Date("2026-01-01T00:00:00.000Z");
  const article = await createArticle({
    userId,
    feedId,
    status: "READ",
    statusChangedAt: readAtTime,
  });

  await markArticleAsStarred(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });
  expect(updated.statusChangedAt.getTime()).toBe(readAtTime.getTime());
});
```

- [ ] **Step 2: Run to verify the ordering test fails for the right reason**

```bash
npx vitest run --project node tests/integration/articleRepository.test.ts
```

Expected: both new tests PASS already — the columns exist and behave correctly
from Task 1. That is the intended result; these are regression locks for the
rest of this task, not red-green drivers. If either fails, Task 1 is wrong and
must be fixed before continuing.

- [ ] **Step 3: Update the stats repository**

In `src/lib/repository/statsRepository.ts`:

- line 16: `readLater: true` → `status: "READ_LATER"`
- line 26-27: `readAt: null, readLater: false` → `status: "UNREAD"`
- line 39: `articles: { where: { readAt: null } }` →
  `articles: { where: { status: "UNREAD" } }` — **this is the pie-chart bug
  fix**
- line 121: replace the `readAt` day-range filter with

```ts
        where: {
          status: "READ",
          statusChangedAt: {
            gte: `${date}T00:00:00.000Z`,
            lte: `${date}T23:59:59.999Z`,
          },
          userId,
        },
```

- [ ] **Step 4: Update the stats tests**

In `tests/integration/statsRepository.test.ts`, swap the factory calls to
`status` and add a regression case for the bug just fixed:

```ts
it("counts unread articles (not read, not read-later)", async () => {
  await createArticle({ userId, feedId });
  await createArticle({ userId, feedId, status: "READ" });
  await createArticle({ userId, feedId, status: "READ_LATER" });

  expect(await getNumberOfUnreadArticles()).toBe(1);
});

it("counts read-later articles", async () => {
  await createArticle({ userId, feedId, status: "READ_LATER" });
  await createArticle({ userId, feedId });

  expect(await getNumberOfReadLaterArticles()).toBe(1);
});

it("does not count read-later articles as unread per feed", async () => {
  await createArticle({ userId, feedId });
  await createArticle({ userId, feedId, status: "READ" });
  await createArticle({ userId, feedId, status: "READ_LATER" });

  const perFeed = await getUnreadArticlesPerFeed();
  expect(perFeed).toEqual([{ feedTitle: "Feed A", unread: 1 }]);
});

it("counts read articles but not hand-rejected ones as read that day", async () => {
  const day = new Date("2026-02-10T12:00:00.000Z");
  await createArticle({
    userId,
    feedId,
    status: "READ",
    statusChangedAt: day,
  });
  await createArticle({
    userId,
    feedId,
    status: "NOT_INTERESTED",
    statusChangedAt: day,
  });

  const { rows } = await getWeeklyArticlesRead(
    new Date("2026-02-10T00:00:00.000Z"),
    new Date("2026-02-10T00:00:00.000Z"),
  );

  expect(rows).toEqual([{ date: "2026-02-10", count: 1 }]);
});
```

Add `getWeeklyArticlesRead` to the imports at the top of that file. This case is
what the fifth enum member buys: today every dismissal counts as a read
regardless of whether the reader engaged with the article.

- [ ] **Step 5: Run the stats tests**

```bash
npx vitest run --project node tests/integration/statsRepository.test.ts
```

Expected: PASS. The third case fails if line 39 was missed.

- [ ] **Step 6: Update every page query**

Apply these edits verbatim:

- `src/app/feed/page.tsx:40-41` — replace `readAt: null,` and
  `readLater: false,` with `status: "UNREAD",`
- `src/app/feed/category/[categoryId]/page.tsx:43-44` — same replacement
- `src/app/feed/read-later/page.tsx:23` — `readLater: true,` →
  `status: "READ_LATER",`
- `src/app/feed/no-unread-articles.tsx:18` — `readLater: true` →
  `status: "READ_LATER"`
- `src/app/feed/[feedId]/no-unread-articles.tsx:23` — `readAt: null` →
  `status: "UNREAD"` (**the second miscount bug**)
- `src/components/navigation/feed-navigation.tsx:27` and `:42` —
  `{ readAt: null, readLater: false }` → `{ status: "UNREAD" }`
- `src/app/feed/history/page.tsx:22-28` — replace the `where` and `orderBy`:

```ts
    where: {
      status: "READ",
      userId: session.user.id,
    },
    orderBy: {
      statusChangedAt: "desc",
    },
```

- `src/app/feed/[feedId]/page.tsx:42-43` — replace the two lines with:

```ts
      status: showSearchParam === "all" ? { in: ["UNREAD", "READ"] } : "UNREAD",
```

The third view option is added in Task 6; this keeps today's two options
working.

- [ ] **Step 7: Update the components**

`src/components/article/article-card.tsx` — both sites become `!== "UNREAD"`,
**not** `=== "READ"`. They ask "is this out of my inbox", and in Task 6 filtered
and rejected articles must behave like read ones here:

- line 79: `if (props.article.readAt !== null) {` →
  `if (props.article.status !== "UNREAD") {`
- line 110: `if (props.article.readAt !== null) {` →
  `if (props.article.status !== "UNREAD") {`

`src/components/article/dismiss-button.tsx:46`:

```ts
const isRead = article.status !== "UNREAD";
```

`src/components/article/toggle-read-later-button.tsx` — introduce a local
`const isReadLater = article.status === "READ_LATER";` above the `return`, then
replace `article.readLater` at lines 55, 62, and 67 with `isReadLater`.

- [ ] **Step 8: Update the component test fixtures**

`tests/components/article/dismiss-button.test.tsx` — replace the fixture and the
second case's override:

```ts
const unreadArticle = {
  id: 1,
  status: "UNREAD",
  title: "Test article",
} as any;
```

```ts
const readArticle = { ...unreadArticle, status: "READ" };
```

`tests/components/article/article-card-actions.test.tsx:24-26` — replace the
`readAt`, `readLater`, and `starred` fixture lines with:

```ts
  status: "UNREAD",
  starred: false,
```

- [ ] **Step 9: Delete the mirror writes**

In `src/lib/repository/articleRepository.ts`, delete the `legacyMirror` helper
and both `...legacyMirror(status)` spreads. The two chokepoint helpers become
exactly what the spec specifies:

```ts
const setArticleStatus = (articleId: number, status: ArticleStatus) =>
  prisma.article.update({
    where: { id: articleId },
    data: { status, statusChangedAt: new Date() },
  });

const setArticleStatusMany = (
  where: Prisma.ArticleWhereInput,
  status: ArticleStatus,
) =>
  prisma.article.updateMany({
    where,
    data: { status, statusChangedAt: new Date() },
  });
```

Also update the two bulk `where` clauses, which still filter on the old columns:
in `markArticlesOlderThanXDaysAsRead` and
`markCategoryArticlesOlderThanXDaysAsRead`, replace `readAt: null,` and
`readLater: false,` with `status: "UNREAD",`.

Then drop the now-dead legacy assertions from
`tests/integration/articleRepository.test.ts` — the `expect(updated.readAt)` and
`expect(updated.readLater)` lines added in Task 1 Step 8. Keep every `status`
assertion.

- [ ] **Step 10: Run the whole suite**

```bash
npm run test
```

Expected: PASS. Nothing outside `prisma/seed.ts` and the factory now mentions
`readAt` or `readLater`; confirm with:

```bash
grep -rn "readAt\|readLater" src/ tests/
```

Expected: matches only in `tests/helpers/factories.ts`.

- [ ] **Step 11: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run format
git add src tests
git commit -m "fix: stop counting read-later articles as unread

Switches every query to the new status column. The dashboard pie chart and
the \"unread in your other feeds\" prompt both omitted the read-later clause
and over-counted; expressing the state as one column rather than two makes
that class of mistake unrepresentable."
```

---

### Task 3: Drop readAt and readLater

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_drop_article_read_flags/migration.sql`
- Modify: `prisma/seed.ts:266,275`
- Modify: `tests/helpers/factories.ts`

**Interfaces:**

- Consumes: everything from Task 2 — this task is safe only because nothing
  reads the old columns.
- Produces: `Article` with no `readAt` or `readLater`.

- [ ] **Step 1: Remove the columns from the schema**

Delete the `readAt` and `readLater` lines from `model Article` in
`prisma/schema.prisma`.

- [ ] **Step 2: Generate and inspect the migration**

```bash
DIR="prisma/migrations/$(date +%Y%m%d%H%M%S)_drop_article_read_flags"
mkdir -p "$DIR"
npx prisma migrate diff --from-config-datasource \
  --to-schema prisma/schema.prisma --script -o "$DIR/migration.sql"
cat "$DIR/migration.sql"
```

**Do not use `prisma migrate dev --create-only` here.** It requires a TTY and
aborts with "environment is non-interactive" under any agent or CI runner.
`migrate diff --from-config-datasource` produces the same `RedefineTables` block
without one. Do not try to fake a TTY — if this command fails, stop.

Expected: a `-- RedefineTables` block with a warning comment naming both dropped
columns. No hand-editing needed this time — there is no data to preserve. Read
the generated `INSERT ... SELECT` and confirm it carries `status`,
`statusChangedAt`, and `filterReason` across.

- [ ] **Step 3: Apply and verify no drift**

```bash
npx prisma migrate deploy && npx prisma generate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Expected: applies cleanly, final command exits `0`.

- [ ] **Step 4: Confirm the data survived**

```bash
npx prisma db execute --url "file:./data/dev.db" --stdin <<'EOF'
SELECT status, COUNT(*) FROM Article GROUP BY status;
EOF
```

Expected: the same counts Task 1 Step 6 reported.

- [ ] **Step 5: Update the factory**

In `tests/helpers/factories.ts`, delete the `readAt`, `readLater` entries from
both the `overrides` type and the `data` object in `createArticle`. Keep
`status`, `statusChangedAt`, `filterReason`, and `starred`.

- [ ] **Step 6: Update the seed**

Task 1 Step 12 already added `status` and `statusChangedAt` to the already-read
loop. Delete the now-orphaned `readAt,` line from that `prisma.article.create`
call, leaving `status` and `statusChangedAt`.

Leave the surrounding `const readAt = randomDateInLastNDays(7);` and the
`publicationDate` line alone — the local variable still drives both.

- [ ] **Step 7: Run the suite and the seed**

```bash
npm run test && npx prisma db seed
```

Expected: tests PASS; the seed completes without error.

- [ ] **Step 8: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm run build && npm run format
git add prisma tests
git commit -m "refactor: drop the readAt and readLater columns"
```

---

### Task 4: Replace the regex title filter with a per-feed interest profile

**Files:**

- Modify: `prisma/schema.prisma`
- Create:
  `prisma/migrations/<timestamp>_replace_title_filter_with_interest_profile/migration.sql`
- Delete: `src/lib/repository/feedFilter.ts`
- Delete: `tests/unit/feedFilter.test.ts`
- Modify: `src/lib/repository/feedSchema.ts:6-21`
- Modify: `src/lib/repository/feedRepository.ts:7,86-89,100`
- Modify: `src/components/feed/feed-form.tsx:42,48,150-169`
- Modify: `tests/helpers/factories.ts:37,46`
- Modify: `tests/unit/feedSchema.test.ts`
- Modify: `tests/unit/scraper.test.ts:46`
- Modify: `tests/integration/feedRepository.test.ts:95`

**Interfaces:**

- Consumes: nothing from Tasks 1-3.
- Produces: `Feed.interestProfile: string` (defaults `""`, empty means the feed
  is not AI-filtered). `FeedSchema` gains `interestProfile: string` and loses
  `titleFilterExpressions`.

- [ ] **Step 1: Swap the field in the schema**

In `model Feed`, replace

```prisma
titleFilterExpressions String        @default("")
```

with

```prisma
interestProfile        String        @default("")
```

- [ ] **Step 2: Generate the migration**

```bash
DIR="prisma/migrations/$(date +%Y%m%d%H%M%S)_replace_title_filter_with_interest_profile"
mkdir -p "$DIR"
npx prisma migrate diff --from-config-datasource \
  --to-schema prisma/schema.prisma --script -o "$DIR/migration.sql"
cat "$DIR/migration.sql"
```

**Do not use `prisma migrate dev --create-only`** — it requires a TTY and aborts
under any agent or CI runner. Do not try to fake one.

- [ ] **Step 3: Edit it to carry the old expressions across**

Prisma will emit a `RedefineTables` block for `Feed` that drops the old column's
data. In the generated `INSERT INTO "new_Feed" (...) SELECT ...`, add
`"interestProfile"` to the column list and this expression to the `SELECT` in
the matching position:

```sql
    CASE WHEN "titleFilterExpressions" <> ''
         THEN 'Do not show articles whose titles match any of these regular expressions:'
              || char(10) || "titleFilterExpressions"
         ELSE '' END
```

A model applies "reject titles matching `^Sponsored:`" perfectly well, so the
reader's intent survives and they can rewrite it as prose later.

- [ ] **Step 4: Apply, verify, and check the carry-over**

```bash
npx prisma migrate deploy && npx prisma generate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
npx prisma db execute --url "file:./data/dev.db" --stdin <<'EOF'
SELECT id, title, interestProfile FROM Feed WHERE interestProfile <> '';
EOF
```

Expected: no drift, and any feed that had expressions now shows them under the
"Do not show articles..." preamble.

- [ ] **Step 5: Delete the regex module and its test**

```bash
git rm src/lib/repository/feedFilter.ts tests/unit/feedFilter.test.ts
```

- [ ] **Step 6: Write the failing test for unfiltered ingest**

In `tests/integration/feedRepository.test.ts`, replace the case at line 95 that
asserts regex filtering with:

```ts
it("persists every fetched item now that regex filtering is gone", async () => {
  const feed = await createFeed({
    userId,
    interestProfile: "Skip sports coverage",
  });
  vi.mocked(scrapeFeed).mockResolvedValue([
    feedItem("Breaking", "https://example.com/a"),
    feedItem("Sports roundup", "https://example.com/b"),
  ]);

  await refreshFeed(feed.id);

  const titles = (
    await prisma.article.findMany({ where: { feedId: feed.id } })
  ).map((a) => a.title);
  expect(titles).toEqual(["Breaking", "Sports roundup"]);
});
```

Same two items the deleted case used, so the diff shows exactly what changed:
the sports item is now kept rather than dropped at ingest. `feedItem`,
`scrapeFeed`, and `vi` are already imported at the top of that file.

- [ ] **Step 7: Run to verify it fails**

```bash
npx vitest run --project node tests/integration/feedRepository.test.ts
```

Expected: FAIL — `createFeed` rejects the unknown `interestProfile` override,
and `feedRepository` still imports the deleted module.

- [ ] **Step 8: Remove the filtering step from the refresh**

In `src/lib/repository/feedRepository.ts`:

- delete the import on line 7
- delete the `filterFeedItemsByTitle` call on lines 86-89
- change line 100 from `filteredFeedItems.map(...)` to `feedItems.map(...)`

- [ ] **Step 9: Update the schema, the form, and the factory**

`src/lib/repository/feedSchema.ts` — replace the whole `titleFilterExpressions`
property (lines 6-21) with:

```ts
  interestProfile: z.string(),
```

There is nothing to validate; it is prose.

`src/components/feed/feed-form.tsx` — at lines 42 and 48, replace
`titleFilterExpressions: editFeed.titleFilterExpressions,` with
`interestProfile: editFeed.interestProfile,` and `titleFilterExpressions: "",`
with `interestProfile: "",`. Then replace the `FormField` block at lines 150-169
with:

```tsx
<FormField
  control={form.control}
  name="interestProfile"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Interest Profile</FormLabel>
      <FormControl>
        <Textarea
          className="resize-none"
          disabled={submitting}
          placeholder="I care about database internals, distributed systems, and language design. Skip funding rounds, executive hires, and conference announcements."
          rows={5}
          {...field}
        />
      </FormControl>
      <FormDescription>
        Articles from this feed that do not match are kept out of your inbox.
        Leave empty to see everything.
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

Add `FormDescription` to the existing `@/components/ui/form` import.

`tests/helpers/factories.ts` — in `createFeed`, rename the
`titleFilterExpressions?: string;` override to `interestProfile?: string;` and
the data line to `interestProfile: overrides.interestProfile ?? "",`.

- [ ] **Step 10: Update the remaining test fixtures**

`tests/unit/scraper.test.ts:46` — replace `titleFilterExpressions: "",` with
`interestProfile: "",`.

`tests/unit/feedSchema.test.ts` — replace `titleFilterExpressions: ""` in the
base fixture with `interestProfile: ""`, delete the two cases at lines 21-33
that exercise regex validity, and add:

```ts
it("accepts an interest profile that is not a valid regular expression", () => {
  const result = feedSchema.safeParse({
    ...validFeed,
    interestProfile: "I like databases [and unclosed brackets",
  });
  expect(result.success).toBe(true);
});
```

- [ ] **Step 11: Run the suite**

```bash
npm run test
```

Expected: PASS, with the `feedFilter` suite gone.

- [ ] **Step 12: Run the full gate and commit**

This is the breaking change; the footer is what release-please reads.

```bash
npm run lint && npm run typecheck && npm run build && npm run format
git add -A
git commit -m "feat!: replace title filter expressions with an interest profile

Each feed now takes a plain-language description of what you want to read
from it instead of a list of regular expressions. Leave it empty to see
everything from that feed.

BREAKING CHANGE: The \"Title Filter Expressions\" field is removed. Existing
expressions are carried over into the new Interest Profile field, which means
feeds that had regex rules become AI-filtered feeds. Rewrite them as prose
when convenient."
```

---

### Task 5: Ask the model for a relevance verdict

**Files:**

- Modify: `src/lib/ai/prompts.ts:15-27`
- Modify: `src/lib/ai/services/leadService.ts`
- Modify: `tests/unit/prompts.test.ts`
- Modify: `tests/integration/leadService.test.ts`

**Interfaces:**

- Consumes: `Feed.interestProfile` (Task 4), `Article.status` and
  `Article.filterReason` (Task 1).
- Produces:
  `buildLeadPrompt(title: string, textContent: string, interestProfile: string): string`.
  `generateAiLead` still returns `Promise<string>` (the lead text) and now may
  leave the article `FILTERED`.

- [ ] **Step 1: Write the failing prompt tests**

Add to `tests/unit/prompts.test.ts`:

```ts
it("leaves the lead prompt unchanged when no interest profile is set", () => {
  const prompt = buildLeadPrompt("Title", "Body", "");

  expect(prompt).not.toContain("interests");
  expect(prompt).toContain("no longer than 80 words");
});

it("states the reader's interests and asks for a verdict when one is set", () => {
  const prompt = buildLeadPrompt("Title", "Body", "Only database internals");

  expect(prompt).toContain("Only database internals");
  expect(prompt).toContain("matchesInterests");
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run --project node tests/unit/prompts.test.ts
```

Expected: FAIL — `buildLeadPrompt` takes two arguments.

- [ ] **Step 3: Extend the prompt builder**

In `src/lib/ai/prompts.ts`, change `buildLeadPrompt` to:

```ts
/**
 * The relevance block is appended only when the feed has an interest profile,
 * so a feed without one produces exactly the prompt it produced before this
 * feature existed — same text, same token count.
 */
const relevanceDirective = (interestProfile: string) =>
  interestProfile === ""
    ? ""
    : `

The reader has described what they want from this feed:

<interests>
${interestProfile}
</interests>

After writing the lead, judge whether this article matches those interests.
Report one sentence of reasoning as \`relevanceReason\`, then your verdict as
\`matchesInterests\`. Write the reasoning in the same language as the lead.`;

export const buildLeadPrompt = (
  title: string,
  textContent: string,
  interestProfile: string,
) =>
  `Write a single paragraph summarizing what the article covers and why it is significant or timely. Be factual and objective. The summary must be no longer than 80 words. Do not copy the article's opening lines verbatim, and do not add introductory phrases, headings, or filler.

First determine the language the article is written in and report it as a two-letter ISO 639-1 code, for example "de" for German. If the language cannot be established, report "und". Write the lead in the language you reported.${relevanceDirective(interestProfile)}

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run --project node tests/unit/prompts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing service tests**

In `tests/integration/leadService.test.ts`, extend the helper and add four
cases:

```ts
const mockVerdict = (
  matchesInterests: boolean,
  relevanceReason: string,
  lead = "Generated lead.",
) =>
  vi.mocked(generateObject).mockResolvedValueOnce({
    object: { language: "en", lead, relevanceReason, matchesInterests },
    usage: { inputTokens: 7, outputTokens: 3 },
  } as never);

describe("relevance filtering", () => {
  it("leaves the article unread when the feed has no interest profile", async () => {
    const article = await createArticle({ userId, feedId });

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.status).toBe("UNREAD");
    expect(stored.filterReason).toBeNull();
  });

  it("filters the article and records the reason when it does not match", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const article = await createArticle({ userId, feedId: filteredFeedId });
    mockVerdict(false, "This is a funding round announcement.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { lead: true },
    });
    expect(stored.status).toBe("FILTERED");
    expect(stored.filterReason).toBe("This is a funding round announcement.");
    expect(stored.lead?.text).toBe("Generated lead.");
  });

  it("sets statusChangedAt when it filters", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const longAgo = new Date("2020-01-01T00:00:00.000Z");
    const article = await createArticle({
      userId,
      feedId: filteredFeedId,
      statusChangedAt: longAgo,
    });
    mockVerdict(false, "Off topic.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.statusChangedAt.getTime()).toBeGreaterThan(longAgo.getTime());
  });

  it("leaves the article unread when the model call throws", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const article = await createArticle({ userId, feedId: filteredFeedId });
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("provider down"));

    await expect(generateAiLead(article.id)).rejects.toThrow("provider down");

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.status).toBe("UNREAD");
  });

  it("leaves the article unread when it does match", async () => {
    const filteredFeedId = (
      await createFeed({ userId, interestProfile: "Only databases" })
    ).id;
    const article = await createArticle({ userId, feedId: filteredFeedId });
    mockVerdict(true, "Directly about query planners.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.status).toBe("UNREAD");
    expect(stored.filterReason).toBeNull();
  });
});
```

The `statusChangedAt` case is the one that keeps the sanctioned chokepoint
exception honest — see the spec's "Filtering at ingest".

- [ ] **Step 6: Run to verify they fail**

```bash
npx vitest run --project node tests/integration/leadService.test.ts
```

Expected: FAIL — status stays `UNREAD` and `filterReason` stays null in the
filtering cases.

- [ ] **Step 7: Produce and store the verdict**

In `src/lib/ai/services/leadService.ts`, keep the existing `leadSchema` as the
no-profile schema and add a second one below it:

```ts
// `relevanceReason` precedes `matchesInterests` for the same reason `language`
// precedes `lead`: structured output is generated field by field, so the model
// reasons and then commits. A boolean declared first would be a guess the
// reasoning is written to justify.
const filteringLeadSchema = leadSchema.extend({
  relevanceReason: z
    .string()
    .describe(
      "One sentence explaining why the article does or does not match the " +
        "reader's stated interests. Write it in the same language as the lead.",
    ),
  matchesInterests: z.boolean(),
});
```

Then rewrite the body of `generateAiLead`:

```ts
export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { feed: true, scrape: true },
    where: { id: articleId },
  });

  const interestProfile = article.feed.interestProfile;
  const filtering = interestProfile !== "";

  const { object, usage } = await generateObject({
    model,
    schema: filtering ? filteringLeadSchema : leadSchema,
    system: systemPrompt,
    prompt: buildLeadPrompt(
      article.title,
      article.scrape?.textContent ?? "",
      interestProfile,
    ),
  });

  const language = normalizeLanguage(object.language);

  // Filtering happens in this same write rather than through
  // `setArticleStatus`, the chokepoint that otherwise owns every status change.
  // Routing it there would mean a second round trip or a row that briefly holds
  // a lead with no verdict. It writes `statusChangedAt` alongside `status` just
  // as the chokepoint does. Do not add a second exception without revisiting
  // the design.
  const filtered = filtering && !object.matchesInterests;

  // One nested write, so the language cannot drift out of step with the lead
  // it was determined alongside, nor the verdict from the reason for it.
  await prisma.article.update({
    where: { id: articleId },
    data: {
      language,
      ...(filtered
        ? {
            status: "FILTERED" as const,
            statusChangedAt: new Date(),
            filterReason: object.relevanceReason,
          }
        : {}),
      lead: {
        upsert: {
          create: { text: object.lead },
          update: { text: object.lead },
        },
      },
    },
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
  );

  logger.info(
    {
      articleId,
      feedId: article.feedId,
      language,
      filtered,
      model: model.modelId,
      tokenUsage: usage,
    },
    "AI lead generated.",
  );

  return object.lead;
};
```

TypeScript narrows `object` by the schema union, so read
`object.relevanceReason` only inside the `filtered` branch. If the compiler
complains about the union, hoist the call into an
`if (filtering) { ... } else { ... }` pair rather than casting.

- [ ] **Step 8: Run to verify they pass**

```bash
npx vitest run --project node tests/integration/leadService.test.ts
```

Expected: PASS, including the six pre-existing language cases.

- [ ] **Step 9: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run format
git add src tests
git commit -m "feat: hide articles that do not match a feed's interest profile

Articles judged irrelevant are kept and hidden rather than deleted, with the
reason recorded, so nothing is lost to a bad call."
```

---

### Task 6: The rejection action and the "Not interested" view

**Files:**

- Modify: `src/lib/repository/articleRepository.ts`
- Create: `src/components/article/not-interested-button.tsx`
- Modify: `src/components/article/article-card-actions.tsx:34-55`
- Modify: `src/components/article/dismiss-button.tsx`
- Modify: `src/components/article/article-card.tsx`
- Rename: `src/app/feed/[feedId]/feed-filter-button.tsx` →
  `src/app/feed/[feedId]/feed-view-button.tsx`
- Modify: `src/app/feed/[feedId]/page.tsx:3,16,23,42,66`
- Modify: `prisma/seed.ts`
- Modify: `tests/components/article/dismiss-button.test.tsx`
- Modify: `tests/components/article/article-card-actions.test.tsx`
- Modify: `tests/integration/articleRepository.test.ts`

**Interfaces:**

- Consumes: `setArticleStatus` (Task 1), `Article.status` and
  `Article.filterReason` (Task 1), the `FILTERED` writer (Task 5).
- Produces:
  - `markArticleAsNotInteresting(articleId: number): Promise<void>`
  - `restoreArticleToInbox(articleId: number): Promise<void>` — renamed from
    `unmarkArticleAsRead`
  - `restoreArticleStatus(articleId: number, status: ArticleStatus): Promise<void>`
    — the Undo target

- [ ] **Step 1: Write the failing repository tests**

Add to `tests/integration/articleRepository.test.ts`:

```ts
it.each(["READ", "FILTERED", "NOT_INTERESTED"] as const)(
  "returns a %s article to the inbox",
  async (status) => {
    const article = await createArticle({
      userId,
      feedId,
      status,
      filterReason: status === "FILTERED" ? "Off topic." : null,
    });

    await restoreArticleToInbox(article.id);

    const updated = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(updated.status).toBe("UNREAD");
    if (status === "FILTERED") {
      expect(updated.filterReason).toBe("Off topic.");
    }
  },
);

it("marks an article as not interesting without inventing a reason", async () => {
  const article = await createArticle({ userId, feedId });

  await markArticleAsNotInteresting(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });
  expect(updated.status).toBe("NOT_INTERESTED");
  expect(updated.filterReason).toBeNull();
});
```

`filterReason` surviving the restore is what makes
`filterReason IS NOT NULL AND status != 'FILTERED'` the set of decisions the
reader overruled.

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run --project node tests/integration/articleRepository.test.ts
```

Expected: FAIL — neither function is exported.

- [ ] **Step 3: Add the actions**

In `src/lib/repository/articleRepository.ts`, rename `unmarkArticleAsRead` to
`restoreArticleToInbox` — it now serves `READ`, `FILTERED`, and
`NOT_INTERESTED`, and the old name described only the first. Add two more:

```ts
export const markArticleAsNotInteresting = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(articleId, "NOT_INTERESTED");

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};

/**
 * Undo target. Takes the status the article held before the action being
 * undone, rather than assuming that action's inverse.
 */
export const restoreArticleStatus = async (
  articleId: number,
  status: ArticleStatus,
) => {
  const updatedArticle = await setArticleStatus(articleId, status);

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};
```

Update the import in `src/components/article/article-card.tsx` and anywhere else
`unmarkArticleAsRead` is referenced:

```bash
grep -rn "unmarkArticleAsRead" src/ tests/
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run --project node tests/integration/articleRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing Undo test**

In `tests/components/article/dismiss-button.test.tsx`, extend the mock and add
the cases:

```ts
vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  restoreArticleToInbox: vi.fn().mockResolvedValue(undefined),
  restoreArticleStatus: vi.fn().mockResolvedValue(undefined),
}));
```

```ts
it.each(["READ", "FILTERED", "NOT_INTERESTED"] as const)(
  "offers Restore for a %s article",
  (status) => {
    render(<DismissButton article={{ ...unreadArticle, status }} />);

    expect(screen.getByRole("button", { name: /restore/i })).toBeTruthy();
  },
);

it("undoes a restore back to the status the article actually held", async () => {
  const filtered = { ...unreadArticle, status: "FILTERED" };
  render(<DismissButton article={filtered} />);

  await userEvent.click(screen.getByRole("button", { name: /restore/i }));

  const [, options] = vi.mocked(toast).mock.calls[0];
  await options!.action!.onClick({} as never);

  expect(restoreArticleStatus).toHaveBeenCalledWith(1, "FILTERED");
});
```

Import `toast` from `sonner` and `restoreArticleStatus` from
`@/lib/repository/articleRepository` at the top of the test file.

- [ ] **Step 6: Run to verify it fails**

```bash
npx vitest run --project components tests/components/article/dismiss-button.test.tsx
```

Expected: FAIL — Undo calls `markArticleAsRead`, landing a filtered article on
`READ`.

- [ ] **Step 7: Fix Undo**

In `src/components/article/dismiss-button.tsx`, capture the prior status and
route Undo through it:

```tsx
const DismissButton = ({
  article,
  className,
  onAfterDismiss,
}: {
  article: Article;
  className?: string;
  onAfterDismiss?: () => void;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInbox = article.status === "UNREAD";

  const handleMarkAsRead = async () => {
    const previous = article.status;
    setIsSubmitting(true);
    await markArticleAsRead(article.id);
    setIsSubmitting(false);
    onAfterDismiss?.();

    toast("Article marked as read", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: () => restoreArticleStatus(article.id, previous),
      },
    });
  };

  const handleRestore = async () => {
    const previous = article.status;
    setIsSubmitting(true);
    await restoreArticleToInbox(article.id);
    setIsSubmitting(false);

    toast("Article restored to your inbox", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: () => restoreArticleStatus(article.id, previous),
      },
    });
  };

  return (
    <Button
      className={className ?? "cursor-pointer justify-start text-sm"}
      disabled={isSubmitting}
      onClick={isInbox ? handleMarkAsRead : handleRestore}
      variant="secondary"
    >
      {isInbox ? (
        <>
          <CheckIcon className="size-4" />
          Dismiss
        </>
      ) : (
        <>
          <ArchiveRestoreIcon className="size-4" />
          Restore
        </>
      )}
    </Button>
  );
};
```

Update the import to
`markArticleAsRead, restoreArticleToInbox, restoreArticleStatus`.

- [ ] **Step 8: Run to verify it passes**

```bash
npx vitest run --project components tests/components/article/dismiss-button.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Add the "not interested" icon action**

Create `src/components/article/not-interested-button.tsx`, following the shape
of `toggle-read-later-button.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Article } from "@/generated/prisma/client";
import {
  markArticleAsNotInteresting,
  restoreArticleStatus,
} from "@/lib/repository/articleRepository";
import { ThumbsDownIcon } from "lucide-react";
import { toast } from "sonner";

const NotInterestedButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const handleClick = async () => {
    const previous = article.status;
    await markArticleAsNotInteresting(article.id);

    toast("Marked as not interesting", {
      description: <span className="italic">{article.title}</span>,
      action: {
        label: "Undo",
        onClick: () => restoreArticleStatus(article.id, previous),
      },
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            onClick={handleClick}
            className="cursor-pointer"
          >
            <ThumbsDownIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Not interested</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NotInterestedButton;
```

In `src/components/article/article-card-actions.tsx`, render it inside
`IconActions`, after `ToggleStarredButton`, suppressed when the article is
already rejected:

```tsx
{
  article.status !== "FILTERED" && article.status !== "NOT_INTERESTED" && (
    <NotInterestedButton article={article} variant={variant} />
  );
}
```

Dismiss keeps its current prominence and wording. The two are deliberately not
peers.

- [ ] **Step 10: Add the view option and the reason display**

Rename the file and update the control:

```bash
git mv src/app/feed/\[feedId\]/feed-filter-button.tsx src/app/feed/\[feedId\]/feed-view-button.tsx
```

In `feed-view-button.tsx`: rename the component to `FeedViewButton`, change the
trigger label from `Filter` to `View`, change `DropdownMenuLabel` to
`Show articles`, and add a third radio item after the existing two:

```tsx
<DropdownMenuRadioItem
  value="rejected"
  onClick={() => router.push(`?show=rejected`)}
>
  Not interested
</DropdownMenuRadioItem>
```

In `src/app/feed/[feedId]/page.tsx`: update the import and the JSX usage at line
66 to `FeedViewButton`, widen the `searchParams` type at line 16 to
`{ show: "all" | "unread" | "rejected" }`, and replace the status predicate:

```ts
      status:
        showSearchParam === "all"
          ? { in: ["UNREAD", "READ"] }
          : showSearchParam === "rejected"
            ? { in: ["FILTERED", "NOT_INTERESTED"] }
            : "UNREAD",
```

In `src/components/article/article-card.tsx`, replace the single-element
`CardContent` at line 143 so the reason sits above the lead:

```tsx
<CardContent className="flex flex-col gap-3 px-4 md:px-6">
  {(props.article.status === "FILTERED" ||
    props.article.status === "NOT_INTERESTED") && (
    <p className="text-muted-foreground border-l-2 pl-3 text-sm italic">
      {props.article.filterReason ?? "You marked this as not interesting."}
    </p>
  )}
  {description()}
</CardContent>
```

The `??` is what renders both members from one branch: `filterReason` is the
model's sentence for a `FILTERED` article and null for a hand rejection.

- [ ] **Step 11: Update the card-actions test and seed all five statuses**

In `tests/components/article/article-card-actions.test.tsx`, add:

```ts
it("offers the not-interested action for an inbox article", () => {
  render(<ArticleCardActions article={article} />);

  expect(screen.getByRole("button", { name: /not interested/i })).toBeTruthy();
});

it("hides the not-interested action for an already-rejected article", () => {
  render(
    <ArticleCardActions article={{ ...article, status: "FILTERED" }} />,
  );

  expect(screen.queryByRole("button", { name: /not interested/i })).toBeNull();
});
```

In `prisma/seed.ts`, immediately after the already-read loop (the one ending at
line 287), add:

```ts
// 3 rejected articles per feed, so the "Not interested" view has content:
// two the model filtered out, one the reader rejected by hand.
for (let i = 0; i < 3; i++) {
  const rejectedAt = randomDateInLastNDays(7);
  const byModel = i < 2;
  const article = await prisma.article.create({
    data: {
      userId,
      feedId: feed.id,
      title: loremTitle(),
      description: lorem(50 + Math.floor(Math.random() * 11)),
      link: `https://example.com/article/${randomUUID()}`,
      publicationDate: new Date(rejectedAt.getTime() - 3600_000),
      status: byModel ? "FILTERED" : "NOT_INTERESTED",
      statusChangedAt: rejectedAt,
      filterReason: byModel
        ? "This is a funding round announcement, not a technical article."
        : null,
    },
  });
  const textContent = lorem(300 + Math.floor(Math.random() * 1201));
  await prisma.articleScrape.create({
    data: { articleId: article.id, textContent, author: randomName() },
  });
  await prisma.articleLead.create({
    data: {
      articleId: article.id,
      text: lorem(50 + Math.floor(Math.random() * 11)),
    },
  });
}
```

Each gets a scrape and a lead like the surrounding loops, so the cards render
fully rather than showing the loading spinner.

Then add a fourth, shorter loop for `READ_LATER`. The seed has **never**
produced read-later articles — a pre-existing gap, not one this work introduced
— so the Read Later page and its sidebar count have always screenshotted empty:

```ts
// 2 read-later articles per feed. The seed never produced any before, so
// the Read Later page screenshotted empty.
for (let i = 0; i < 2; i++) {
  const savedAt = randomDateInLastNDays(7);
  const article = await prisma.article.create({
    data: {
      userId,
      feedId: feed.id,
      title: loremTitle(),
      description: lorem(50 + Math.floor(Math.random() * 11)),
      link: `https://example.com/article/${randomUUID()}`,
      publicationDate: new Date(savedAt.getTime() - 3600_000),
      status: "READ_LATER",
      statusChangedAt: savedAt,
    },
  });
  const textContent = lorem(300 + Math.floor(Math.random() * 1201));
  await prisma.articleScrape.create({
    data: { articleId: article.id, textContent, author: randomName() },
  });
  await prisma.articleLead.create({
    data: {
      articleId: article.id,
      text: lorem(50 + Math.floor(Math.random() * 11)),
    },
  });
}
```

All five statuses are then represented, which is what the Testing section below
claims.

Also give one seeded feed a non-empty `interestProfile` so the feed edit dialog
screenshots show the field populated.

- [ ] **Step 12: Run everything and commit**

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run format
git add -A
git commit -m "feat: add a Not interested action and a view to review hidden articles

Articles you reject by hand and articles the interest profile filtered out
share one view, each showing why it was hidden, and either can be put back in
your inbox from there."
```

---

### Task 7: Refresh the screenshots

**Files:**

- Modify: `docs/screenshots/*.png`

- [ ] **Step 1: Regenerate against the new seed**

```bash
npm run update-screenshots
```

Expected: the four PNGs under `docs/screenshots/` update. This runs
`prisma db seed` then Playwright, so it needs the browsers installed
(`npx playwright install` if it complains).

- [ ] **Step 2: Look at them**

Open `docs/screenshots/desktop-light.png` and confirm the feed page shows the
**View** control rather than **Filter**. If the seeded filtered articles are not
visible, that is expected — they only appear under the third view.

- [ ] **Step 3: Commit**

```bash
git add docs/screenshots
git commit -m "chore: update README screenshots"
```

---

## Verification before opening the PR

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
npx vitest run --project components
npx playwright test
```

Then confirm the migrations replay from empty onto a throwaway database, since
the test suite never runs them:

```bash
rm -f /tmp/replay.db
DATABASE_URL="file:/tmp/replay.db" npx prisma migrate deploy
```

Expected: all three new migrations apply in order with no error.

Open the PR with `gh pr create` against `main`. The user reviews and merges — do
not merge without explicit instruction.

## Known gaps, recorded deliberately

- **The migrations are never exercised by CI.** `vitest.setup.ts` uses
  `prisma db push`. The manual verification steps in Tasks 1, 3, and 4 plus the
  replay check above are the only coverage.
- **The spec calls for one migration; this plan writes three.** Splitting the
  `Article` change from the `Feed` change is what lets Tasks 1-3 and Task 4 be
  reviewed and reverted independently. The data mappings are unchanged from the
  spec.
- **A page loaded mid-refresh can briefly show an article about to be
  filtered.** The row is created `UNREAD` and flipped inside `processArticle`.
  Accepted in the spec; not a bug.
- **The AI filter fails open.** A provider outage leaves articles `UNREAD` and
  visible. Accepted in the spec.
