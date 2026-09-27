# Read Later in the Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home inbox at `/feed` lists Read Later articles after the unread
ones, in a single article list.

**Architecture:** A new server-only module `src/lib/inbox.ts` returns the
reader's unread articles followed by their Read Later articles. Each group is
fetched by its own query and sorted newest publication date first.
`src/app/feed/page.tsx` renders that combined list with the existing
`<ArticleList>`. The empty state loses its now-unreachable "Go to Read Later"
block.

**Tech Stack:** Next.js (App Router, server components), Prisma 7 with SQLite,
Vitest integration tests against a per-worker SQLite file.

**Spec:** `docs/superpowers/specs/2026-09-27-read-later-in-inbox-design.md`

## Global Constraints

- Work happens in the worktree `.claude/worktrees/read-later-in-inbox` on branch
  `feat/read-later-in-inbox`. Never touch the main checkout.
- Commit messages: Conventional Commits **without scopes**, ending with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never use `git commit --no-verify`. The Husky pre-commit hook runs ESLint and
  Prettier on staged files.
- `src/lib/inbox.ts` must **not** carry a `"use server"` directive. Exported
  functions in a `"use server"` module become client-callable server actions,
  and this function takes a `userId`.
- Do not put the new function in `src/lib/article.ts`. Client components import
  that file, and it must not import Prisma.
- `ArticleList`, the Read Later page, the sidebar,
  `src/app/feed/[feedId]/no-unread-articles.tsx`, and every status transition
  stay unchanged.
- This version of Next.js differs from older ones. Read the relevant guide in
  `node_modules/next/dist/docs/` before relying on any Next.js API not already
  used in the file you're editing.

---

### Task 1: `getInboxArticles` query

**Files:**

- Create: `src/lib/inbox.ts`
- Test: `tests/integration/inbox.test.ts`

**Interfaces:**

- Consumes: `prisma` default export from `@/lib/prismaClient`; `Prisma`
  namespace from `@/generated/prisma/client`.
- Produces:
  - `export type InboxArticle` =
    `Prisma.ArticleGetPayload<{ include: { feed: true; lead: true; scrape: true } }>`
  - `export const getInboxArticles: (userId: string) => Promise<InboxArticle[]>`
    returns all of the user's `UNREAD` articles (newest `publicationDate`
    first), followed by all of their `READ_LATER` articles (newest
    `publicationDate` first).

- [ ] **Step 1: Prepare the worktree**

A fresh worktree has no generated Prisma client and no `.env`. From the worktree
root:

```bash
npm install
npx prisma generate
test -f .env || cp ../../../.env .env
```

Then confirm the baseline is green:

```bash
npm run test
```

Expected: all test files pass. If anything fails before you've changed code,
stop and report it. Don't work around it.

- [ ] **Step 2: Write the failing test**

Create `tests/integration/inbox.test.ts`:

```ts
import { getInboxArticles } from "@/lib/inbox";
import { beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  const feed = await createFeed({ userId });
  feedId = feed.id;
});

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

describe("getInboxArticles", () => {
  it("lists unread articles before read later ones, each newest first", async () => {
    await createArticle({
      userId,
      feedId,
      title: "unread old",
      publicationDate: day(1),
    });
    await createArticle({
      userId,
      feedId,
      title: "later newest",
      status: "READ_LATER",
      publicationDate: day(20),
    });
    await createArticle({
      userId,
      feedId,
      title: "unread new",
      publicationDate: day(10),
    });
    await createArticle({
      userId,
      feedId,
      title: "later old",
      status: "READ_LATER",
      publicationDate: day(2),
    });

    const articles = await getInboxArticles(userId);

    expect(articles.map((article) => article.title)).toEqual([
      "unread new",
      "unread old",
      "later newest",
      "later old",
    ]);
  });

  it("leaves out read and filtered articles", async () => {
    await createArticle({ userId, feedId, title: "unread" });
    await createArticle({ userId, feedId, title: "read", status: "READ" });
    await createArticle({
      userId,
      feedId,
      title: "filtered",
      status: "FILTERED",
    });

    const articles = await getInboxArticles(userId);

    expect(articles.map((article) => article.title)).toEqual(["unread"]);
  });

  it("leaves out other users' articles", async () => {
    const other = await createUser();
    const otherFeed = await createFeed({ userId: other.id });
    await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      title: "someone else's unread",
    });
    await createArticle({
      userId: other.id,
      feedId: otherFeed.id,
      title: "someone else's later",
      status: "READ_LATER",
    });
    await createArticle({ userId, feedId, title: "mine" });

    const articles = await getInboxArticles(userId);

    expect(articles.map((article) => article.title)).toEqual(["mine"]);
  });

  it("includes the feed, lead and scrape the article list renders", async () => {
    await createArticle({ userId, feedId });

    const [article] = await getInboxArticles(userId);

    expect(article.feed.id).toBe(feedId);
    expect(article).toHaveProperty("lead", null);
    expect(article).toHaveProperty("scrape", null);
  });
});
```

The first test deliberately gives a Read Later article the newest date of all
("later newest", day 20). It fails if the implementation sorts the combined list
by date instead of keeping the groups in order. `resetDb` runs before each test
via `vitest.setup.ts`, so tests don't see each other's rows.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/integration/inbox.test.ts`

Expected: FAIL. Vite cannot resolve `@/lib/inbox` (for example
`Failed to resolve import "@/lib/inbox"` or `Cannot find module`).

- [ ] **Step 4: Write the implementation**

Create `src/lib/inbox.ts`:

```ts
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";

const include = {
  feed: true,
  lead: true,
  scrape: true,
} satisfies Prisma.ArticleInclude;

export type InboxArticle = Prisma.ArticleGetPayload<{
  include: typeof include;
}>;

/**
 * The home inbox: every unread article, then every article saved for later,
 * each group newest first.
 *
 * Read Later articles are listed here, below the unread ones, so that saving
 * an article for later does not hide it from the page the reader triages on.
 *
 * Two queries rather than one sorted by `status`: SQLite stores the enum as
 * text, so a status sort would only get the groups in order by accident of
 * spelling.
 *
 * Deliberately not `"use server"` and not in `articleRepository.ts`, which is:
 * an exported function there becomes a server action a client could call with
 * any `userId`. Only server components may import this module.
 */
export const getInboxArticles = async (
  userId: string,
): Promise<InboxArticle[]> => {
  const [unread, readLater] = await Promise.all([
    prisma.article.findMany({
      include,
      where: { status: "UNREAD", userId },
      orderBy: { publicationDate: "desc" },
    }),
    prisma.article.findMany({
      include,
      where: { status: "READ_LATER", userId },
      orderBy: { publicationDate: "desc" },
    }),
  ]);

  return [...unread, ...readLater];
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/inbox.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`

Expected: exits 0 with no errors.

- [ ] **Step 7: Do not commit yet**

Leave the two files uncommitted. Task 2 commits them together with the page
change as a single `feat:` commit. The repo's guidelines ask for `feat:` commits
that are meaningful in the changelog, and an unused query is not.

---

### Task 2: Show the combined list on `/feed`

**Files:**

- Modify: `src/app/feed/page.tsx` (whole file, shown below)
- Modify: `src/app/feed/no-unread-articles.tsx` (whole file, shown below)
- Modify: `docs/prd.md` (feature 9 "Views" and the "Daily triage" key flow)

**Interfaces:**

- Consumes: `getInboxArticles(userId: string): Promise<InboxArticle[]>` from
  `@/lib/inbox` (Task 1).
- Produces: nothing other tasks rely on.

- [ ] **Step 1: Wire the page to `getInboxArticles`**

Replace the contents of `src/app/feed/page.tsx` with:

```tsx
import Dashboard from "@/app/feed/dashboard";
import FeedTitle from "@/app/feed/feed-title";
import NoFeedsMessage from "@/app/feed/no-feeds-message";
import NoUnreadArticles from "@/app/feed/no-unread-articles";
import RefreshAllFeedsButton from "@/app/feed/refresh-all-feeds-button";
import ArticleList from "@/components/article/article-list";
import TopNavigation from "@/components/navigation/top-navigation";
import { auth } from "@/lib/auth";
import { getInboxArticles } from "@/lib/inbox";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const MyFeeds = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const feedCount = await prisma.feed.count({
    where: { userId: session.user.id },
  });
  if (feedCount === 0) {
    return <NoFeedsMessage />;
  }

  const { lastFetched } = await prisma.feed.findFirstOrThrow({
    select: { lastFetched: true },
    where: { userId: session.user.id },
    orderBy: { lastFetched: "desc" },
  });

  const articles = await getInboxArticles(session.user.id);
  // The count measures triage progress, so it leaves out articles already
  // saved for later; the sidebar badge counts those.
  const unreadCount = articles.filter(
    (article) => article.status === "UNREAD",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <TopNavigation page="Feeds" />

      <Dashboard />

      <div className="flex flex-col items-center gap-2 xl:flex-row">
        <FeedTitle
          title="Your Latest Reads"
          articleCount={unreadCount}
          lastUpdated={lastFetched}
        />

        <div className="grow" />

        <div>
          <RefreshAllFeedsButton />
        </div>
      </div>

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <NoUnreadArticles />
      )}
    </div>
  );
};

export default MyFeeds;
```

What changed compared to the current file: the `getInboxArticles` import, the
inline `prisma.article.findMany` (which included an unused `user`) replaced by
`getInboxArticles`, and `articleCount` now fed from `unreadCount`. The feed
count and `lastFetched` queries stay as they are.

- [ ] **Step 2: Remove the unreachable Read Later block from the empty state**

> **Superseded during execution:** skip this step. The category pages also use
> this component and list only unread articles, so the block is still reachable
> there. On `/feed` it hides itself, because it only renders when the Read Later
> count is non-zero. The file stays unchanged; see the spec's "Empty state"
> section.

The empty state now renders only when there are no unread **and** no Read Later
articles, so its "saved for later" block can never show. Replace the contents of
`src/app/feed/no-unread-articles.tsx` with:

```tsx
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CheckCircle } from "lucide-react";

const NoUnreadArticles = () => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CheckCircle />
        </EmptyMedia>
        <EmptyTitle>All caught up!</EmptyTitle>
        <EmptyDescription>
          You&apos;ve read all your unread articles. Great job staying informed!
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-muted-foreground text-xs">
          New articles will appear here as your feeds update
        </p>
      </EmptyContent>
    </Empty>
  );
};

export default NoUnreadArticles;
```

Do **not** touch `src/app/feed/[feedId]/no-unread-articles.tsx`. It belongs to
the per-feed pages, which are out of scope.

- [ ] **Step 3: Update the PRD**

In `docs/prd.md`, feature 9, change:

```markdown
9. **Views.** Home inbox across all feeds, per-feed and per-category views with
   an All / Unread / Filtered switch, Read Later, Starred, History of the last
   50 read articles, and full-text search over titles and article text.
```

to:

```markdown
9. **Views.** Home inbox across all feeds, listing unread articles and then
   those saved for later; per-feed and per-category views with an All / Unread /
   Filtered switch, Read Later, Starred, History of the last 50 read articles,
   and full-text search over titles and article text.
```

In the "Daily triage" key flow, change:

```markdown
- **Daily triage.** Sign in, land on the home inbox, skim leads, dismiss or read
  later as you go, open a text or audio summary for the few articles that
  warrant it, open the original for the ones that warrant more.
```

to:

```markdown
- **Daily triage.** Sign in, land on the home inbox, skim leads, dismiss or read
  later as you go, open a text or audio summary for the few articles that
  warrant it, open the original for the ones that warrant more. Articles saved
  for later stay in the inbox, below the unread ones, until they are dismissed.
```

- [ ] **Step 4: Run the checks**

```bash
npm run format
npm run lint
npm run typecheck
npm run test
```

Expected: `format` may rewrap the PRD and nothing else. `lint` and `typecheck`
exit 0. All tests pass, including `tests/integration/inbox.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbox.ts tests/integration/inbox.test.ts src/app/feed/page.tsx src/app/feed/no-unread-articles.tsx docs/prd.md
git commit -m "feat: show Read Later articles in the home inbox below unread ones

Articles saved for later used to vanish from /feed onto a page that had to be
visited on purpose, so they were rarely read. The home inbox now lists them
after the unread articles, each group newest first, in the same article list,
so keyboard navigation runs through both.

The query lives in src/lib/inbox.ts rather than the \"use server\"
articleRepository, where an exported function taking a userId would be a
client-callable server action. The header count stays unread-only, and the
empty state drops its now-unreachable link to Read Later.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: the pre-commit hook runs and the commit succeeds. If the hook changes
files, check `git status` shows a clean tree afterwards.

---

### Task 3: Verify in the running app and open the PR

**Files:** none changed, unless the smoke test finds a bug. In that case fix it,
rerun Task 2 Step 4, and commit with `fix:`.

- [ ] **Step 1: Production build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 2: Smoke test against a throwaway database**

Use a scratch database under the gitignored `.tmp/` so the real one is never
touched. From the worktree root:

```bash
DATABASE_URL=file:./.tmp/smoke.sqlite npx prisma migrate deploy
```

Start the dev server in the background, logging to `.tmp/dev.log`:

```bash
DATABASE_URL=file:./.tmp/smoke.sqlite BASE_URL=http://localhost:3100 npm run dev -- -p 3100
```

Sign up the first user, who becomes admin, with a POST to
`http://localhost:3100/api/auth/sign-up/email` (JSON body `name`, `email`,
`password`). Sign in with `/api/auth/sign-in/email` using a cookie jar, or sign
in through the browser.

Seed data with a small `npx tsx` script that builds its own `PrismaClient`
pointed at `.tmp/smoke.sqlite`. Wrap it in an `async main()`, because top-level
await is not allowed there. Create one feed whose `link` points at an empty RSS
file served by `python3 -m http.server` from `.tmp/`, so refreshes make no AI
calls. Add three `UNREAD` and two `READ_LATER` articles with distinct
`publicationDate`s, and give one Read Later article the newest date of all.

Then check in a browser at `http://localhost:3100/feed`:

1. The three unread articles come first, newest first, then the two Read Later
   ones, newest first, each with a filled bookmark. The header count says 3.
2. Pressing `n` repeatedly walks from the last unread card onto the first Read
   Later card.
3. Clicking the bookmark on an unread card moves it into the Read Later group,
   and the header count drops to 2. Clicking it again moves it back.
4. After dismissing all unread articles, the Read Later articles are still
   listed and "All caught up!" does not appear.
5. After dismissing the Read Later articles too, "All caught up!" appears with
   no "Go to Read Later" button.

Stop the dev server and the HTTP server afterwards.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/read-later-in-inbox
gh pr create --base main --title "feat: show Read Later articles in the home inbox below unread ones" --body "..."
```

Put these in the PR body:

- a short summary of the change and why (Read Later articles were out of sight
  and never read)
- a link to the spec path
- the smoke-test checklist from Step 2, with results
- the closing line
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

- [ ] **Step 4: Wait for CI**

Run: `gh pr checks --watch`

Expected: `format-check`, `lint`, `typecheck`, `test` and `build` all pass. If
one fails, fix the cause and push again. Do **not** merge; the user reviews and
merges.
