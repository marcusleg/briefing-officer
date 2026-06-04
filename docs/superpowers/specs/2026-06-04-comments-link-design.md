# Comments Link Feature Design

**Date:** 2026-06-04

## Overview

Add a "Comments" link button to article cards that opens the RSS `<comments>` URL in a new tab. The button is only shown when the RSS item includes a `<comments>` element. Atom feeds do not have this field and will never show the button.

## Data Layer

Add an optional column to the `Article` model in `prisma/schema.prisma`:

```prisma
commentsLink String?
```

Run a Prisma migration to apply the schema change.

## Parsing Layer

**File:** `src/lib/scraper.ts`

After calling `parseFeed(fetchedFeed)`, extract all `<comments>` URLs from the raw XML string using a regex over all `<comments>...</comments>` occurrences. Collect results into an array and zip by index with `parsedFeed.items`. Item `i` receives `commentsUrls[i]` or `undefined` if absent.

The extracted URL is included in the `validFeedItems` entries alongside `title`, `link`, `description`, and `publicationDate`. Atom feeds produce no matches and all items get `undefined`.

## Storage Layer

**File:** `src/lib/repository/feedRepository.ts`

Pass `commentsLink` through to `prisma.article.create()`. No other changes needed.

## UI Layer

**New component:** `src/components/article/comments-button.tsx`

Mirrors `VisitButton`. Renders only when `article.commentsLink` is truthy. Opens in a new tab with `target="_blank"` and `referrerPolicy="no-referrer"`. Uses the same ghost/sm button variant and an appropriate icon (e.g. `MessageSquare` from lucide-react).

**Modified:** `src/components/article/article-card-actions.tsx`

Place `<CommentsButton>` immediately to the right of `<VisitButton>`.

## Out of Scope

- Atom feed comments support (no equivalent field in the spec)
- Backfilling existing articles with comments URLs
- Marking articles as read when clicking the comments link
