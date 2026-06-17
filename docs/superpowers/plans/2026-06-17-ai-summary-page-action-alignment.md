# AI Summary Page Action Button Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the AI Summary page action button layout with ArticleCard by consolidating responsive layout and reading time into `ArticleCardActions`, moving the back button out of that component, and restructuring the AI Summary page layout.

**Architecture:** The responsive two-row mobile layout currently duplicated in `ArticleCard`'s footer moves into `ArticleCardActions`, which gains an optional `readingTime` prop. `ArticleCard` simplifies its footer to a single `ArticleCardActions` call. The AI Summary page restructures its layout to show a standalone `BackButton` at the top and `ArticleCardActions` at the bottom after the summary content.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, Prisma, `reading-time` npm package, shadcn/ui components

## Global Constraints

- No new dependencies
- Follow existing Tailwind class patterns (see `article-card.tsx` for reference)
- All TypeScript — no `any` types
- `reading-time` package is already installed; import as `import readingTime from "reading-time"`
- `ReadingTime` result type: `{ text: string; minutes: number; time: number; words: number }`

---

### Task 1: Refactor `ArticleCardActions` — remove back button, add responsive layout and `readingTime` prop

**Files:**
- Modify: `src/components/article/article-card-actions.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface ArticleCardActionsProps {
    article: Prisma.ArticleGetPayload<{ include: { feed: true; scrape: true } }>;
    hideSummarizeButton?: boolean;
    readingTime?: { text: string; minutes: number; time: number; words: number };
  }
  ```

- [ ] **Step 1: Replace the component**

Replace the entire file content with:

```tsx
"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
import CommentsButton from "@/components/article/comments-button";
import ToggleReadButton from "@/components/article/toggle-read-button";
import ToggleReadLaterButton from "@/components/article/toggle-read-later-button";
import ToggleStarredButton from "@/components/article/toggle-starred-button";
import VisitButton from "@/components/article/visit-button";
import { Prisma } from "@prisma/client";
import { ClockIcon } from "lucide-react";

interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  hideSummarizeButton?: boolean;
  readingTime?: { text: string; minutes: number; time: number; words: number };
}

const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <>
    {/* Mobile: row 1 — reading time left, icon buttons right */}
    <div className="flex w-full items-center gap-2 md:hidden">
      {props.readingTime && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <ClockIcon className="size-3" />
          {props.readingTime.text}
        </span>
      )}
      <div className="grow" />
      <ToggleReadLaterButton article={props.article} variant="ghost" />
      <ToggleStarredButton article={props.article} variant="ghost" />
      <CommentsButton article={props.article} variant="ghost" />
    </div>

    {/* Mobile: row 2 — full-width labeled buttons */}
    <div className="flex w-full gap-2 md:hidden">
      <ToggleReadButton
        article={props.article}
        className="flex-1 justify-center text-sm"
      />
      {!props.hideSummarizeButton && (
        <AiSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          className="flex-1 justify-center text-sm"
        />
      )}
      <VisitButton
        article={props.article}
        className="flex-1 justify-center text-sm"
      />
    </div>

    {/* Desktop: single row */}
    <div className="hidden md:flex md:w-full md:items-center md:gap-2">
      {props.readingTime && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <ClockIcon className="size-3" />
          {props.readingTime.text}
        </span>
      )}
      <div className="grow" />
      <ToggleReadLaterButton article={props.article} />
      <ToggleStarredButton article={props.article} />
      <CommentsButton article={props.article} />
      <ToggleReadButton
        article={props.article}
        className="cursor-pointer justify-start text-sm"
      />
      {!props.hideSummarizeButton && (
        <AiSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          size="sm"
          className="justify-start text-sm"
        />
      )}
      <VisitButton
        article={props.article}
        size="sm"
        className="justify-start text-sm"
      />
    </div>
  </>
);

export default ArticleCardActions;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/marcus/Documents/Programming/briefing-officer
npx tsc --noEmit
```

Expected: no errors (there will be type errors in `article-card.tsx` about the removed props — that's fine, they'll be fixed in Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/components/article/article-card-actions.tsx
git commit -m "refactor: consolidate responsive layout and readingTime into ArticleCardActions, remove back button"
```

---

### Task 2: Simplify `ArticleCard` footer

**Files:**
- Modify: `src/components/article/article-card.tsx`

**Interfaces:**
- Consumes: `ArticleCardActions` with props `{ article, readingTime? }`

- [ ] **Step 1: Replace the CardFooter section**

In `src/components/article/article-card.tsx`, replace the entire `<CardFooter>` block (lines 143–186) with:

```tsx
<CardFooter className="flex-col gap-3 border-t px-4 md:flex md:flex-row md:items-center md:gap-2 md:px-6">
  <ArticleCardActions
    article={props.article}
    readingTime={articleReadingTime}
  />
</CardFooter>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and visually verify the card layout**

```bash
npm run dev
```

Open `http://localhost:3000/feed` in a browser. Check:
- Desktop: single row with reading time left, all action buttons right
- Mobile (resize to < 768px): two rows — row 1 icon buttons with reading time, row 2 full-width Dismiss/Summarize/Visit

- [ ] **Step 4: Commit**

```bash
git add src/components/article/article-card.tsx
git commit -m "refactor: simplify ArticleCard footer to use ArticleCardActions"
```

---

### Task 3: Restructure the AI Summary page

**Files:**
- Modify: `src/app/feed/[feedId]/article/[articleId]/ai-summary/page.tsx`

**Interfaces:**
- Consumes: `ArticleCardActions` with props `{ article, hideSummarizeButton: true, readingTime? }`
- Consumes: `BackButton` from `@/components/navigation/back-button`

- [ ] **Step 1: Replace the page file content**

Replace the entire `page.tsx` with:

```tsx
"use server";

import AiSummaryStream from "@/components/article/ai-summary-stream";
import ArticleCardActions from "@/components/article/article-card-actions";
import ArticleMeta from "@/components/article/article-meta";
import IntlRelativeTime from "@/components/intl-relative-time";
import BackButton from "@/components/navigation/back-button";
import TopNavigation from "@/components/navigation/top-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import readingTime from "reading-time";

const AiSummary = async (props0: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const params = await props0.params;
  let articleId = parseInt(params.articleId);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  const article = await prisma.article.findUnique({
    include: {
      feed: true,
      scrape: true,
    },
    where: {
      id: articleId,
      userId: session.user.id,
    },
  });
  if (!article) {
    notFound();
  }

  const articleReadingTime = article.scrape
    ? readingTime(article.scrape.textContent)
    : undefined;

  return (
    <div className="m-2 flex flex-col gap-2">
      <TopNavigation
        segments={[
          { name: "Feeds", href: "/feed" },
          { name: article.feed.title, href: `/feed/${article.feed.id}` },
        ]}
        page="AI Summary"
      />

      <article className="mx-auto flex max-w-4xl flex-col gap-4">
        <BackButton />

        <div className="flex items-baseline gap-2 text-base">
          <span className="text-muted-foreground font-semibold tracking-wide uppercase">
            {article.feed.title}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            <IntlRelativeTime date={article.publicationDate} />
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight">{article.title}</h2>

        <ArticleMeta author={article.scrape?.author} />

        {article.scrape ? (
          <AiSummaryStream articleId={article.id} />
        ) : (
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Summary unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so an AI summary
              cannot be generated.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-muted-foreground text-sm">
          Source: <Link href={article.link}>{article.link}</Link>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:gap-2">
          <ArticleCardActions
            article={article}
            hideSummarizeButton
            readingTime={articleReadingTime}
          />
        </div>
      </article>
    </div>
  );
};

export default AiSummary;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Visually verify the AI Summary page**

With dev server running, navigate to any article's AI Summary page. Check:
- `BackButton` appears at the top of the article area
- Article header (feed name, date, title, author) appears below
- AI summary stream renders
- Source link appears after summary
- Action bar appears at the bottom with reading time and buttons
- Desktop: single row layout
- Mobile (resize to < 768px): two-row layout, no Summarize button visible

- [ ] **Step 4: Commit**

```bash
git add src/app/feed/[feedId]/article/[articleId]/ai-summary/page.tsx
git commit -m "feat: restructure AI summary page layout to match ArticleCard design"
```
