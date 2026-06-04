# Comments Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a "Comments" link button on article cards when the RSS feed item includes a `<comments>` URL, opening in a new tab.

**Architecture:** Add `commentsLink String?` to the `Article` schema; extract the field from raw RSS XML in `scrapeFeed` via regex alongside the existing `parseFeed` call; pass it through to `prisma.article.create`; render a new `CommentsButton` component in `article-card-actions.tsx` conditionally when the field is present.

**Tech Stack:** Prisma (SQLite), Next.js Server Components, Vitest (unit + integration), TypeScript

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `prisma/migrations/<timestamp>_add_comments_link/migration.sql` (auto-generated) |
| Modify | `src/lib/scraper.ts` |
| Modify | `tests/integration/feedRepository.test.ts` |
| Create | `src/components/article/comments-button.tsx` |
| Modify | `src/components/article/article-card-actions.tsx` |

---

### Task 1: Create feature branch

- [ ] **Step 1: Create and switch to a new branch**

```bash
git checkout -b feat/comments-link
```

Expected: `Switched to a new branch 'feat/comments-link'`

---

### Task 2: Add `commentsLink` to the Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field to the Article model**

In `prisma/schema.prisma`, find the `Article` model and add `commentsLink` after `link`:

```prisma
model Article {
  id              Int            @id @default(autoincrement())
  title           String
  publicationDate DateTime
  description     String?
  content         String?
  link            String
  commentsLink    String?
  readAt          DateTime?
  readLater       Boolean        @default(false)
  starred         Boolean        @default(false)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  feedId          Int
  feed            Feed           @relation(fields: [feedId], references: [id], onDelete: Cascade)
  scrape          ArticleScrape?
  lead            ArticleLead?
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, feedId, link])
}
```

- [ ] **Step 2: Run the migration**

```bash
npm run prisma:migrate-dev -- --name add_comments_link
```

Expected output includes: `The following migration(s) have been applied` and `✓ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add commentsLink field to Article schema"
```

---

### Task 3: Extract `<comments>` in `scrapeFeed` and update the return type

**Files:**
- Modify: `src/lib/scraper.ts`

- [ ] **Step 1: Update the `scrapeFeed` function**

Replace the entire `scrapeFeed` function in `src/lib/scraper.ts` (lines 73–106) with:

```typescript
export const scrapeFeed = async (feed: Feed) => {
  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);
  if (!parsedFeed) {
    logger.error(
      { feed: { id: feed.id, title: feed.title, link: feed.link } },
      "Unable to parse feed.",
    );

    throw new Error("Unable to parse feed.");
  }

  const commentsUrls = [...fetchedFeed.matchAll(/<comments>(.*?)<\/comments>/gs)].map(
    (m) => m[1].trim(),
  );

  const validFeedItems: Pick<
    Article,
    "title" | "link" | "description" | "publicationDate" | "commentsLink"
  >[] = [];
  parsedFeed.items.forEach((item, index) => {
    if (!item.title || !item.link || !item.pubDate) {
      logger.error({ item }, "Invalid feed item.");
    } else {
      validFeedItems.push({
        title: item.title,
        link: item.link,
        description: item.description ? item.description : null,
        publicationDate: new Date(item.pubDate),
        commentsLink: commentsUrls[index] ?? null,
      });
    }
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ARTICLE_RETENTION_DAYS);

  return validFeedItems.filter((item) => item.publicationDate >= thirtyDaysAgo);
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/scraper.ts
git commit -m "feat: extract <comments> URL from RSS feed items"
```

---

### Task 4: Add unit tests for `<comments>` extraction in `scrapeFeed`

**Files:**
- Create: `tests/unit/scraper.test.ts`

The existing integration tests mock `scrapeFeed` entirely, so we need a unit test that exercises the extraction logic directly. We mock `fetch` and `parseFeed` to control the inputs.

- [ ] **Step 1: Create the test file**

Create `tests/unit/scraper.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("htmlparser2", () => ({
  parseFeed: vi.fn(),
}));

vi.mock("@/lib/prismaClient", () => ({ default: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/ai/services/leadService", () => ({ generateAiLead: vi.fn() }));

import { parseFeed } from "htmlparser2";
import { scrapeFeed } from "@/lib/scraper";
import type { Feed } from "@prisma/client";

const makeFeed = (link = "https://example.com/feed.xml"): Feed =>
  ({
    id: 1,
    title: "Test Feed",
    link,
    userId: "user-1",
    autoRefresh: true,
    lastFetched: new Date(0),
    createdAt: new Date(),
    updatedAt: new Date(),
    titleFilterExpressions: "",
    feedCategoryId: null,
  }) as Feed;

const makeRssItem = (title: string, link: string) => ({
  title,
  link,
  description: "desc",
  pubDate: new Date(),
  media: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scrapeFeed", () => {
  it("returns commentsLink when RSS item has <comments> element", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
          <comments>https://example.com/1#comments</comments>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml)));
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Article 1", "https://example.com/1")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items).toHaveLength(1);
    expect(items[0].commentsLink).toBe("https://example.com/1#comments");
    vi.unstubAllGlobals();
  });

  it("returns null commentsLink when RSS item has no <comments> element", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Article 1</title>
          <link>https://example.com/1</link>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml)));
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Article 1", "https://example.com/1")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items).toHaveLength(1);
    expect(items[0].commentsLink).toBeNull();
    vi.unstubAllGlobals();
  });

  it("assigns commentsLink by position — item without comments gets null", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Article 1</title>
          <comments>https://example.com/1#comments</comments>
        </item>
        <item>
          <title>Article 2</title>
        </item>
      </channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml)));
    vi.mocked(parseFeed).mockReturnValue({
      type: "rss2",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [
        makeRssItem("Article 1", "https://example.com/1"),
        makeRssItem("Article 2", "https://example.com/2"),
      ],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].commentsLink).toBe("https://example.com/1#comments");
    expect(items[1].commentsLink).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns null commentsLink for Atom feeds (no <comments> element)", async () => {
    const xml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom Article</title>
          <link href="https://example.com/atom/1"/>
        </entry>
      </feed>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml)));
    vi.mocked(parseFeed).mockReturnValue({
      type: "atom",
      id: "",
      title: "Test",
      link: "",
      description: "",
      items: [makeRssItem("Atom Article", "https://example.com/atom/1")],
    } as ReturnType<typeof parseFeed>);

    const items = await scrapeFeed(makeFeed());

    expect(items[0].commentsLink).toBeNull();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
npm test -- tests/unit/scraper.test.ts
```

Expected: `4 tests passed`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/scraper.test.ts
git commit -m "test: unit tests for commentsLink extraction in scrapeFeed"
```

---

### Task 5: Update the integration test helper to include `commentsLink`

**Files:**
- Modify: `tests/integration/feedRepository.test.ts`

The `feedItem` helper in the integration test returns a mock `scrapeFeed` result. It needs `commentsLink` to match the updated return type, so existing tests don't get TypeScript errors.

- [ ] **Step 1: Update the `feedItem` helper**

In `tests/integration/feedRepository.test.ts`, update the `feedItem` helper (lines 36–41):

```typescript
const feedItem = (title: string, link: string) => ({
  title,
  link,
  description: null,
  publicationDate: new Date(),
  commentsLink: null,
});
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/integration/feedRepository.test.ts
git commit -m "test: add commentsLink to feedItem helper"
```

---

### Task 6: Create the `CommentsButton` component

**Files:**
- Create: `src/components/article/comments-button.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/article/comments-button.tsx`:

```typescript
"use client";

import { buttonVariants } from "@/components/ui/button";
import { Article } from "@prisma/client";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

interface CommentsButtonProps {
  article: Pick<Article, "commentsLink">;
  size?: "sm" | "default" | "lg" | "icon";
}

const CommentsButton = ({ article }: CommentsButtonProps) => {
  if (!article.commentsLink) return null;

  return (
    <Link
      className={buttonVariants({
        className: "text-xs",
        size: "sm",
        variant: "ghost",
      })}
      href={article.commentsLink}
      target="_blank"
      referrerPolicy="no-referrer"
    >
      <MessageSquare className="mr-1 size-4" />
      Comments
    </Link>
  );
};

export default CommentsButton;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/article/comments-button.tsx
git commit -m "feat: add CommentsButton component"
```

---

### Task 7: Wire `CommentsButton` into `article-card-actions.tsx`

**Files:**
- Modify: `src/components/article/article-card-actions.tsx`

- [ ] **Step 1: Import and place `CommentsButton`**

In `src/components/article/article-card-actions.tsx`, add the import and place `<CommentsButton>` immediately after `<VisitButton>`. The full file should look like:

```typescript
"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
import CommentsButton from "@/components/article/comments-button";
import ToggleReadButton from "@/components/article/toggle-read-button";
import ToggleReadLaterButton from "@/components/article/toggle-read-later-button";
import ToggleStarredButton from "@/components/article/toggle-starred-button";
import VisitButton from "@/components/article/visit-button";
import BackButton from "@/components/navigation/back-button";
import { Separator } from "@/components/ui/separator";
import { Prisma } from "@prisma/client";

interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  hideAiSummary?: boolean;
  showBackButton?: boolean;
}

const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <div className="grid w-full grid-cols-2 justify-items-start gap-y-1 md:flex md:w-auto md:grid-cols-none">
    {props.showBackButton && (
      <>
        <BackButton />
        <Separator className="mx-1 h-auto py-4" orientation="vertical" />
      </>
    )}

    <ToggleReadButton article={props.article} />
    <VisitButton article={props.article} size="sm" />
    <CommentsButton article={props.article} />
    {!props.hideAiSummary && (
      <AiSummaryButton
        feedId={props.article.feedId}
        articleId={props.article.id}
        size="sm"
      />
    )}
    <ToggleReadLaterButton article={props.article} />
    <ToggleStarredButton article={props.article} />
  </div>
);

export default ArticleCardActions;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/article/article-card-actions.tsx
git commit -m "feat: show CommentsButton in article card actions"
```

---

### Task 8: Verify in the browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open an RSS feed that includes `<comments>` elements** (e.g. `https://hnrss.org/show?points=100`) and verify:
  - Articles with a `<comments>` URL show a "Comments" button to the right of "Visit Original"
  - Clicking it opens the comments URL in a new tab
  - Articles without a `<comments>` URL show no button

- [ ] **Step 3: Open an Atom feed and verify no "Comments" button appears on any article**
