# Read Later in the Inbox — Design

Date: 2026-09-27

## Summary

The home inbox at `/feed` lists Read Later articles after the unread ones, in a
single article list. The Read Later page stays as it is.

## Motivation

`/feed` only shows `UNREAD` articles. Marking an article Read Later moves it to
a separate page that the reader has to choose to visit, and nothing ever brings
it back into view. Read Later is also protected from bulk "mark as read" and
from deletion, so nothing ever clears it out either. The list fills up with
articles that are never read.

The reader has responded by not using Read Later. Articles they mean to read are
left unread instead, because that keeps them visible. The inbox then fills up
with unread articles that have in fact already been triaged.

The reader does decide on each article. "Later" rarely has a time attached, and
the decision fails because Read Later is out of sight. Showing Read Later
articles on the page the reader already uses fixes that without asking for any
new decision at triage time.

## Goals

- Every Read Later article is visible on `/feed` without a trip to another page.
- Unread articles stay first, so triage works exactly as before.
- Keyboard navigation (`n` / `p` and the per-card hotkeys) moves through unread
  and Read Later articles as one sequence.
- Marking an article Read Later on `/feed` moves it down the list. It is no
  longer counted as unread, and the reader can still see it.

## Non-goals

These ideas were considered while brainstorming and deliberately left out:

- **Snooze for a set time.** The reader rarely knows when "later" is, so
  choosing a duration would add friction at triage time.
- **Resurfacing old Read Later articles.** Once Read Later articles are always
  visible on `/feed`, being seen is enough. This can be revisited if they still
  pile up.
- **Separate triage and reading modes.** These help a reader who avoids
  deciding, and that is not the problem here.
- **A section heading or divider between the groups.** Read Later cards already
  show a filled bookmark, which is enough to tell them apart.
- **Changes to per-feed and per-category pages**, to the Read Later page, to the
  sidebar, or to article status transitions.

## Design

### Query

A new module, `src/lib/inbox.ts`, exports:

```ts
getInboxArticles(userId: string): Promise<InboxArticle[]>;
```

It runs two queries for the given user, each with the includes `/feed` uses
today (`feed`, `lead`, `scrape`, `user`) and each ordered by `publicationDate`
descending:

1. articles with `status: "UNREAD"`
2. articles with `status: "READ_LATER"`

It returns the unread articles followed by the Read Later articles.

Using two queries, not one query sorted by `status`, is deliberate. SQLite
stores the enum as text, so sorting on `status` sorts alphabetically. A
descending sort would give the right order only because `"UNREAD"` happens to
come after `"READ_LATER"` alphabetically, and adding or renaming a status could
silently reorder the inbox.

The function is not placed in `src/lib/repository/articleRepository.ts`, even
though that is where article queries usually live. That module is
`"use server"`, so everything it exports is a server action the client can call.
A read that takes a `userId` argument would let a client read another user's
inbox. `src/lib/article.ts` is also ruled out, because client components import
it and it must not pull in Prisma. `src/lib/inbox.ts` has no `"use server"`
directive and is imported only by the server component.

### Page

`src/app/feed/page.tsx` replaces its inline `prisma.article.findMany` with
`getInboxArticles(session.user.id)` and passes the result to the existing
`<ArticleList>`. Nothing else on the page changes except the following:

- The title count ("Your Latest Reads") shows the number of **unread** articles
  only, as it does today. It measures triage progress, and the sidebar already
  shows a separate Read Later count. The page gets that number by counting
  entries with `status === "UNREAD"` in the returned list, so it doesn't need
  another query.
- The article list is shown when the combined list is non-empty. The "All caught
  up!" empty state is shown only when there are no unread articles **and** no
  Read Later articles.

### `ArticleList`

`ArticleList` is unchanged. It already handles the merged list correctly:

- A single list means a single selection and a single set of `n` / `p` hotkeys.
  Pressing `n` on the last unread article moves to the first Read Later article.
- Holding back live updates behind "Show N new articles" works by article id.
  Marking an article Read Later doesn't change its id, so the article is already
  "seen" and simply moves to its new position. New articles from a feed refresh
  always arrive as `UNREAD`, so they are held back exactly as they are today.

### Empty state

`src/app/feed/no-unread-articles.tsx` loses its "You have N saved for later / Go
to Read Later" block and the `prisma.article.count` query behind it. The
component now only renders when Read Later is empty too, so that branch could
never be reached. With the query gone the component needs neither `async` nor
`getUserId`, and the `BookmarkIcon`, `Button` and `Link` imports can be removed.

The separate `src/app/feed/[feedId]/no-unread-articles.tsx` used by per-feed
pages is out of scope and stays unchanged.

### Revalidation

No change is needed. Every status write in `articleRepository.ts` (read, read
later, restore, not interested, undo) already calls `revalidatePath("/feed")`,
so moving an article between groups re-renders the page.

## Documentation

- `docs/prd.md`, feature 9 (Views): say that the home inbox lists Read Later
  articles after the unread ones.
- `docs/prd.md`, the "Daily triage" key flow: mention that articles saved for
  later stay in the inbox, below the unread ones.
- `docs/reference/article-status.md` describes storage and transitions, not
  views, and does not need a change.

## Testing

- **Integration test** `tests/integration/inbox.test.ts` for `getInboxArticles`,
  using the existing helpers in `tests/helpers/db.ts` and
  `tests/helpers/factories.ts`. It checks that:
  - unread articles come before Read Later articles, even when a Read Later
    article has a newer publication date than every unread one
  - within each group, newer publication dates come first
  - `READ` and `FILTERED` articles are excluded
  - another user's articles are excluded
- **Manual check** in the running app:
  - Read Later articles appear below the unread ones on `/feed`.
  - Marking an unread article Read Later moves it down, and turning Read Later
    off moves it back up.
  - `n` moves from the last unread article to the first Read Later article.
  - With no unread articles, the Read Later articles are listed, and "All caught
    up!" does not appear.
  - With both groups empty, "All caught up!" appears without the Read Later
    block.

The rest of the change is wiring inside a server component, and `/feed` has no
page-level test today. It does not justify new page-level test infrastructure.
