# AI Summary Page Action Button Alignment

**Date:** 2026-06-17  
**Status:** Approved

## Problem

The action buttons on the AI Summary page
(`/feed/[feedId]/article/[articleId]/ai-summary`) have diverged from the
improved design in `ArticleCard`. The card has a responsive two-row mobile
layout and desktop single-row layout. The AI Summary page renders
`ArticleCardActions` directly (desktop-only layout) above the article header,
with no reading time and a back button mixed into the action bar.

## Goals

- Align the AI Summary page action button layout with `ArticleCard`
- Move responsive layout logic into `ArticleCardActions` (single source of
  truth)
- Move reading time display into `ArticleCardActions` (shared by both surfaces)
- Move the back button out of `ArticleCardActions` — each page manages its own
  navigation
- Place action buttons below the article summary on the AI Summary page
- Simplify the `ArticleCard` footer by removing duplicated mobile layout JSX

## Design

### `ArticleCardActions` changes

**Props:**

- Remove `showBackButton` — callers manage their own back navigation
- Rename `hideAiSummary` → `hideSummarizeButton` — kept to suppress the
  Summarize button on the AI Summary page itself
- Add `readingTime?: ReturnType<typeof readingTime>` — optional pre-computed
  reading time; when present, renders the clock + text left-aligned

**Responsive layout (moved in from `ArticleCard`):**

Mobile — two rows:

- Row 1: reading time (left), icon-only buttons — ReadLater, Starred, Comments
  (right)
- Row 2: full-width labeled buttons — Dismiss, Summarize (if not hidden), Visit

Desktop — single row:

- Reading time left-aligned, all buttons right-aligned (existing behavior)

**Separator + BackButton** JSX is removed entirely.

### `ArticleCard` changes

The mobile two-row layout JSX in the `<CardFooter>` is removed. The footer
becomes a single
`<ArticleCardActions article={article} readingTime={articleReadingTime} />` call
for both mobile and desktop.

### AI Summary page changes

**Prisma query:** Add `scrape: true` to the include so reading time can be
computed.

**Layout (top to bottom):**

1. `TopNavigation` (breadcrumbs — unchanged)
2. `BackButton` (standalone, replaces the old `showBackButton` prop usage)
3. Article header: feed name · date, title, author
4. `AiSummaryStream` (the summary content)
5. Source link
6. `ArticleCardActions article={article} hideSummarizeButton readingTime={articleReadingTime}`
   — action bar at the bottom, matching card placement

## Files Affected

- `src/components/article/article-card-actions.tsx` — responsive layout, new
  `readingTime` prop, remove back button logic, rename prop
- `src/components/article/article-card.tsx` — simplify footer, remove duplicated
  mobile layout JSX
- `src/app/feed/[feedId]/article/[articleId]/ai-summary/page.tsx` — add scrape
  to query, restructure layout, add standalone BackButton, move
  ArticleCardActions to bottom

## Out of Scope

- Changes to individual button components (ToggleReadButton, VisitButton, etc.)
- Changes to `TopNavigation`
- Any new button types or behaviors
