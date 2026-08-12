# Article Status and AI Filtering — Design

Date: 2026-08-12

## Summary

Replace the article's `readAt` / `readLater` pair with a single
`status ArticleStatus` column, and add a fourth state — `FILTERED` — for
articles a language model judges to be of no interest to the reader. The
judgement is made per feed, against a free-text interest profile the reader
writes, and it is produced as extra structured-output fields on the lead
generation call that already runs for every new article. Filtered articles are
kept, hidden from the inbox, and reviewable behind a new option in the feed
page's view selector, where the model's stated reason is shown and the article
can be pulled back into the inbox.

The regex-based `Feed.titleFilterExpressions` feature is removed. Its contents
migrate into the new interest profile so no reader's intent is silently lost.

## Motivation

Two problems, one change.

**The article state machine is spread across two columns with an invariant
nothing enforces.** `readAt` and `readLater` are already mutually exclusive in
practice — `markArticleAsRead` clears `readLater` — but nothing in the schema
says so, and the codebase pays for it:

- `statsRepository.ts:39` counts unread articles per feed as `readAt: null`,
  omitting the `readLater: false` that the other unread queries carry. The pie
  chart on the dashboard therefore counts read-later articles as unread.
- `app/feed/[feedId]/no-unread-articles.tsx:23` drops the same clause, so the
  "you have N unread articles in your other feeds" prompt over-counts too.
- `markArticleAsReadLater` does not clear `readAt`, so an article that is read
  and then marked read-later appears in both History and Read Later at once.

All three are the same bug wearing different clothes: a two-column encoding of a
one-column fact. The first two are what happens when a predicate has to be
remembered rather than expressed — eight query sites carry it and two forgot.
Adding a third column for filtering would make it worse — every inbox query
would become `readAt: null, readLater: false, filtered: false`, three columns
with eight combinations of which four are legal.

**There is no way to have the application ignore articles the reader does not
care about.** `titleFilterExpressions` is the closest thing, and it is a blunt
instrument: it matches titles with regular expressions, it runs before the
article is stored, and what it rejects is gone without trace.

## Goals

- One column is the single source of truth for an article's state, and illegal
  states are unrepresentable.
- A reader can describe, in prose and per feed, what they do and do not want to
  read, and articles that do not match are kept out of the inbox.
- Every filtering decision is reviewable, reversible, and carries the reason it
  was made.
- History keeps its current ordering — most recently read first — exactly.

## Non-goals

- **A global interest profile.** The profile is per feed. "From this feed I only
  care about database releases" is the useful unit; a single global profile
  cannot express it, and a global profile plus per-feed overrides means two
  places to look when a filter misbehaves.
- **A settings page.** Because the profile is per feed, it lives in the existing
  feed edit dialog next to the field it replaces. Nothing needs a new route.
- **Retroactively filtering existing articles.** `ARTICLE_RETENTION_DAYS` is
  365, so the existing corpus is not going to age out quickly, but running a
  billable pass over it is not worth it. Every existing article migrates to
  `UNREAD`, `READ`, or `READ_LATER`; none becomes `FILTERED`.
- **Re-judging an article when its feed's interest profile changes.** The
  verdict is made once, at ingest. Editing a profile affects articles fetched
  afterwards. Articles already filtered stay filtered until the reader pulls
  them back.
- **Learning from the reader's corrections.** Pulling an article out of
  `FILTERED` records that it happened — `filterReason` survives — but nothing
  feeds it back into the prompt. That would be a separate feature built on the
  data this one starts collecting.
- **A cheap pre-filter.** See "Accepted regressions".

## Decisions and their alternatives

**A status enum rather than a `filtered` boolean.** The boolean was the smaller
change and was rejected: it adds a third column to a state machine that is
already one column too wide, leaves all three existing bugs in place, and
requires every inbox query site to hand-write a three-clause predicate. The enum
makes those sites read `status: UNREAD`, fixes the two miscounts as a
consequence rather than as separate work, and makes the double-listing bug
unrepresentable.

**`readAt` is removed rather than kept alongside the status.** Keeping it was
considered so that History's sort key would not change. It was rejected because
`status === READ` and `readAt !== null` assert the same fact in two places,
which is precisely the drift the enum exists to eliminate — the new schema would
have shipped with the old flaw intact.

`statusChangedAt` replaces it, and History's ordering is preserved exactly, not
approximately. For any article whose status is currently `READ`,
`statusChangedAt` is by construction the moment it became read:

| Transition            | `statusChangedAt`            | Effect on History                                             |
| --------------------- | ---------------------------- | ------------------------------------------------------------- |
| → `READ`              | set to now                   | enters, keyed to the read moment                              |
| `READ` → `UNREAD`     | set to now                   | leaves — as today, where `unmarkArticleAsRead` nulls `readAt` |
| `READ` → `READ_LATER` | set to now                   | leaves — today it wrongly stays in both lists                 |
| star / unstar         | untouched                    | none                                                          |
| → `FILTERED`          | only from `UNREAD` at ingest | none                                                          |

The one row where behaviour differs is `READ` → `READ_LATER`, which is the
double-listing bug being fixed.

This guarantee holds only while nothing writes `statusChangedAt` outside a
status change, so that is enforced structurally rather than by convention — see
"Writing the status".

**`starred` stays a boolean.** It is the one flag that is genuinely orthogonal:
a read article can be starred, and a starred article can be read, read-later, or
filtered. Folding it into the enum would require `READ_AND_STARRED`-style
products.

**The verdict rides on the existing lead generation call.** `generateAiLead`
already makes one `generateObject` call per new article and already writes its
result in a single nested update. Two more fields on that schema cost no extra
request, no extra latency beyond a few output tokens, and inherit the error
handling that already wraps the call. A separate classification call, or a
cheaper pre-scrape judgement on the title alone, were both rejected — the first
doubles the request count for no benefit, the second is the thing being removed.

**An empty interest profile means the feed is not filtered.** No separate
`aiFilterEnabled` boolean. The opt-in is self-describing, there is no way to
enable filtering without saying what to filter on, and the unfiltered path stays
byte-identical to today's prompt and schema.

**`filterReason` is set once and never cleared.** When the reader pulls an
article out of `FILTERED`, the reason stays on the row.
`filterReason IS NOT NULL AND status != 'FILTERED'` is then the set of decisions
the reader overruled — the filter-quality signal — without a second table or an
audit log.

## Accepted regressions

The regex filter is removed in favour of the model. Two things get worse, both
knowingly:

**Determinism and cost.** The current form's own placeholder is
`^(Advertisement: |Sponsored: ).+$`, which is exactly the case a regex handles
for free, instantly, and identically every time. Under this design a sponsored
post is fetched, scraped, and sent to a model before being rejected. The AI
filter saves the reader's attention, not tokens or bandwidth.

**It fails open.** The verdict is produced inside the call that
`feedRepository.ts:62` wraps in a `try`/`catch`. A provider outage, a rate limit
that exhausts its retries, or a malformed response leaves the article `UNREAD`
and visible. The regex never failed. Failing open is the right default — an
unfiltered inbox beats a silently discarded one — but it means filtering quality
tracks provider availability.

Neither justifies keeping two filtering mechanisms. A cheap deterministic
pre-filter can be reintroduced later without touching the status model, which is
the part that is expensive to change.

This does not strand deployments without an AI provider, because there are none:
`leadService.ts:12` resolves the model at module load and
`getFirstConfiguredLanguageModel` throws when nothing is configured, so such a
deployment already cannot import `feedRepository` or refresh a feed.

## Schema

```prisma
enum ArticleStatus {
  UNREAD
  READ_LATER
  FILTERED
  READ
}

model Article {
  // replaces readAt and readLater
  status          ArticleStatus @default(UNREAD)
  statusChangedAt DateTime      @default(now())
  filterReason    String?
  starred         Boolean       @default(false)   // unchanged
  // ...
}

model Feed {
  // replaces titleFilterExpressions
  interestProfile String @default("")
  // ...
}
```

`statusChangedAt` is a plain `DateTime @default(now())` and explicitly **not**
`@updatedAt`. Making it `@updatedAt` would let scraping, lead generation, and
starring reshuffle History.

`prisma validate` accepts an enum against a SQLite datasource on the Prisma
7.9.1 in use here, but the generated DDL was not confirmed. If
`prisma migrate dev` cannot emit a workable migration for it, fall back to
`status String @default("UNREAD")` with a TypeScript union and a `CHECK`
constraint in the migration. Both satisfy the "use types generated by Prisma"
ADR; the enum is preferred for the exhaustiveness checking it gives `switch`
statements.

## Migration

One migration, handwritten, because Prisma cannot infer either data mapping.
`prisma migrate dev` will generate a destructive version that drops and
recreates the columns; edit it to preserve data before committing.

**Article state:**

```sql
status = CASE WHEN readLater THEN 'READ_LATER'
              WHEN readAt IS NOT NULL THEN 'READ'
              ELSE 'UNREAD' END

statusChangedAt = CASE WHEN readLater THEN updatedAt
                       WHEN readAt IS NOT NULL THEN readAt
                       ELSE createdAt END
```

`readLater` deliberately takes precedence over `readAt`. The only way a row
holds both today is read → then marked read-later, which is a deliberate "put it
back", so `READ_LATER` is the reader's most recent intent. For those rows
`updatedAt` is the closest available approximation of when that happened;
`statusChangedAt` is only load-bearing for `READ` rows, where it is exact.

**Interest profile:**

```sql
interestProfile = CASE
  WHEN titleFilterExpressions <> ''
  THEN 'Do not show articles whose titles match any of these regular expressions:'
       || char(10) || titleFilterExpressions
  ELSE '' END
```

A model applies "reject titles matching `^Sponsored:`" perfectly well, so intent
survives the move and the reader can rewrite it as prose at their leisure. The
consequence worth stating in the release notes: **feeds that had regex rules
become AI-filtered feeds**, which is the intent of the change but is a behaviour
change nonetheless.

Then drop `readAt`, `readLater`, and `titleFilterExpressions`.

This removes a documented user-facing feature, so the change ships as `feat!:`
with a breaking-change footer.

## Writing the status

`articleRepository.ts` is currently seven near-identical exported functions,
each hand-rolling a `prisma.article.update` and its own `revalidatePath` calls.
Two private helpers become the sole writers of `status` and `statusChangedAt`:

```ts
// The only writers of `status` and `statusChangedAt`. Pairing the two writes
// here is what lets History treat `statusChangedAt` as the read timestamp: for
// a READ article it is, by construction, the moment it became read. Anything
// that writes one without the other breaks that.
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

Every exported function becomes one of those calls plus its existing
`revalidatePath`s. `markArticleAsRead` collapses from
`{ readAt: new Date(), readLater: false }` — two writes maintaining an
unenforced invariant — to a single status assignment.

The bulk paths, `markArticlesOlderThanXDaysAsRead` and
`markCategoryArticlesOlderThanXDaysAsRead`, move to `setArticleStatusMany` and
their `readAt: null, readLater: false` predicates become `status: UNREAD`.

One new exported action, `keepArticle`, moves an article from `FILTERED` to
`UNREAD` without touching `filterReason`.

`deleteArticlesOlderThanXDays` keeps its meaning: its
`readLater: false, starred: false` predicate becomes
`status: { not: READ_LATER }, starred: false`, so filtered articles are swept
with the rest.

## Query migration

Every read site, with its new predicate:

| Site                                              | Was                                      | Becomes                                     |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| `app/feed/page.tsx:40`                            | `readAt: null, readLater: false`         | `status: UNREAD`                            |
| `app/feed/[feedId]/page.tsx:42`                   | `readAt` conditional, `readLater: false` | see "View selector"                         |
| `app/feed/category/[categoryId]/page.tsx:43`      | `readAt: null, readLater: false`         | `status: UNREAD`                            |
| `app/feed/history/page.tsx:22,28`                 | `readAt: { not: null }`, sort `readAt`   | `status: READ`, sort `statusChangedAt`      |
| `app/feed/read-later/page.tsx:23`                 | `readLater: true`                        | `status: READ_LATER`                        |
| `app/feed/starred-articles/page.tsx:23`           | `starred: true`                          | unchanged                                   |
| `app/feed/[feedId]/no-unread-articles.tsx:23`     | `readAt: null` — **the bug**             | `status: UNREAD`                            |
| `app/feed/no-unread-articles.tsx:18`              | `readLater: true`                        | `status: READ_LATER`                        |
| `components/navigation/feed-navigation.tsx:27,42` | `readAt: null, readLater: false`         | `status: UNREAD`                            |
| `statsRepository.ts:16`                           | `readLater: true`                        | `status: READ_LATER`                        |
| `statsRepository.ts:26`                           | `readAt: null, readLater: false`         | `status: UNREAD`                            |
| `statsRepository.ts:39`                           | `readAt: null` — **the bug**             | `status: UNREAD`                            |
| `statsRepository.ts:121`                          | `readAt` day range                       | `status: READ`, `statusChangedAt` day range |
| `components/article/article-card.tsx:79,110`      | `readAt !== null`                        | `status === "READ"`                         |
| `components/article/dismiss-button.tsx:46`        | `readAt !== null`                        | `status === "READ"`                         |
| `components/article/toggle-read-later-button.tsx` | `readLater`                              | `status === "READ_LATER"`                   |

`app/feed/search/page.tsx` has no state predicate today and gains none, so
filtered articles remain findable by explicit search. Finding an article you
went looking for by name should not depend on a relevance judgement made before
you knew you wanted it.

Fixing `statsRepository.ts:39` and `no-unread-articles.tsx:23` changes the
dashboard pie chart's numbers and the empty-state count for any reader with
read-later articles. That is the point, but it will look like a regression to
anyone who does not know it was a bug.

## Filtering at ingest

`refreshFeed` loses its filtering step entirely: `filterFeedItemsByTitle` is
deleted, `feedFilter.ts` is deleted, and every fetched item is persisted.
`processArticle` loses nothing and runs, as now, for every newly created
article.

`generateAiLead` gains the feed's interest profile. It already loads the
article; it adds `feed: true` to the existing `include` to reach
`interestProfile`.

When `interestProfile` is empty, the schema and prompt are exactly what they are
today — same fields, same text, same token count. When it is non-empty, the
schema gains two fields:

```ts
z.object({
  language: /* unchanged */,
  lead: z.string(),
  relevanceReason: z
    .string()
    .describe(
      "One sentence explaining why the article does or does not match the " +
        "reader's stated interests. Write it in the same language as the lead.",
    ),
  matchesInterests: z.boolean(),
});
```

Field order is load-bearing for the same reason `language` precedes `lead`:
structured output is generated field by field, so the model writes the lead,
then reasons about relevance, then commits to a verdict. A boolean declared
first would be a guess the reasoning is written to justify.

`buildLeadPrompt` gains a parameter and, when a profile is supplied, a block
stating the reader's interests and asking for the two extra fields. The lead is
still written for every article, filtered or not, so the review view has
something to show.

`matchesInterests === false` writes `status: FILTERED`,
`statusChangedAt: new Date()`, and `filterReason: relevanceReason` in the same
nested update that already writes the language and lead — one query, so the
verdict cannot drift from the reason that produced it.

This makes `generateAiLead` the one writer of `status` outside the chokepoint,
and that is the decision rather than something to resolve at implementation
time. Routing it through `setArticleStatus` would mean either a second round
trip or a row that briefly holds a lead with no verdict, and both are worse than
one sanctioned exception. It is sanctioned on three conditions: it writes
`statusChangedAt` alongside `status` like the chokepoint does, it carries a
comment pointing at `setArticleStatus` as the rule it is excepted from, and the
`statusChangedAt` test named below covers this path specifically. A second
exception should not be added without revisiting the design.

The article row is created `UNREAD` and flipped to `FILTERED` moments later,
inside `processArticle`. `refreshFeed` awaits all of `processArticle` before its
final `revalidatePath`, so this is not visible in normal use; a page loaded
mid-refresh can briefly show an article that is about to be filtered. Accepted,
and recorded here so it is not later mistaken for a bug.

The `logger.info` payload in `generateAiLead` gains `matchesInterests`, so "why
did this article never reach my inbox" is answerable from the logs.

## Feed form

`feedSchema` drops `titleFilterExpressions` and its regex `.refine()`, and gains
`interestProfile: z.string()`. There is nothing to validate — it is prose.

`feed-form.tsx` swaps one textarea for another: label "Interest Profile", help
text explaining that leaving it empty disables AI filtering for the feed, and a
placeholder in the shape of an actual profile rather than a pattern, e.g.
`I care about database internals, distributed systems, and language design. Skip funding rounds, executive hires, and conference announcements.`

## View selector

`feed-filter-button.tsx` is renamed to `feed-view-button.tsx` and the control is
relabelled **View**. The word "filter" now means one thing in this application —
the AI deciding an article is not for you — and a control that chooses which
articles are listed is a view selector, not a filter.

| Option       | `show`             | Predicate                        |
| ------------ | ------------------ | -------------------------------- |
| All articles | `all`              | `status: { in: [UNREAD, READ] }` |
| Unread only  | `unread` (default) | `status: UNREAD`                 |
| Filtered out | `filtered`         | `status: FILTERED`               |

"All articles" continues to exclude `READ_LATER`, as it does today, and now also
excludes `FILTERED`: filtered articles surface only when explicitly asked for,
which is the entire point of filtering them.

In the `filtered` view each card shows its `filterReason` and gains a **Keep**
action — `keepArticle`, moving it to `UNREAD`. The action is named "Keep" rather
than "Restore" because `DismissButton` already renders a "Restore" label for
un-reading a read article, and two adjacent buttons meaning different kinds of
undo would be worse than either.

The reason is rendered as muted text near the lead. It is written in the
article's language, matching the lead it sits beside.

## Error handling

Nothing new is caught; every new failure drains into a path that already exists.

- **Model call fails, or output fails schema validation.** Caught by the
  existing `try`/`catch` at `feedRepository.ts:62`, logged, article kept. It is
  `UNREAD` because that is its default — the reader sees an unfiltered article
  rather than losing one. Same outcome as any of today's lead failures, reached
  a new way.
- **Scrape failed.** `textContent` is `""`, as today. The model judges relevance
  from the title alone. A weaker judgement, but the reader can see and correct
  it.
- **Empty interest profile.** No verdict is requested and none is parsed. The
  article stays `UNREAD`.
- **`filterReason` on an article that is no longer filtered.** Not an error —
  the deliberate record of an overruled decision. Only rendered in the
  `filtered` view.

Schema-validation failures are not retried, for the reasons recorded in
`2026-08-06-article-language-design.md`: the AI SDK's retry wrapper covers only
transport failures. That analysis is unchanged by adding two fields.

## Testing

Following the repo's split: `node` for unit and integration, `components` for
jsdom.

**Deleted** — `tests/unit/feedFilter.test.ts`, along with the module it covers.

**`tests/helpers/factories.ts`** — `createArticle` swaps `readAt` / `readLater`
overrides for `status` and `statusChangedAt`; `createFeed` swaps
`titleFilterExpressions` for `interestProfile`. Every dependent test updates
mechanically. `tests/unit/scraper.test.ts:46` builds a `Feed` literal by hand
rather than through the factory, so it needs the same swap directly.

**`tests/integration/articleRepository.test.ts`** — the existing cases port to
the new column. Three additions:

- History ordering, seeded from three articles read at known distinct times,
  asserting the `status: READ` / `statusChangedAt desc` query returns them
  newest-first. This is the test that locks the behaviour the design promises.
- `statusChangedAt` is not `@updatedAt`: read an article, then star it, scrape
  it, and generate a lead for it, and assert `statusChangedAt` has not moved.
  Paired with a case in `leadService.test.ts` asserting that the sanctioned
  ingest exception _does_ set `statusChangedAt` when it writes `FILTERED` —
  between them, the only writes that move it are status changes.
- `keepArticle` moves `FILTERED` to `UNREAD` and leaves `filterReason` set.

**`tests/integration/statsRepository.test.ts`** — updates for the new column,
and its unread-per-feed case becomes a regression test for the
`statsRepository.ts:39` bug: a read-later article must not be counted as unread.

**`tests/integration/leadService.test.ts`** — the existing `vi.mock("ai", …)`
extends to the new fields. Cases: an empty interest profile requests no verdict
and leaves the article `UNREAD`; `matchesInterests: false` sets `FILTERED` and
stores the reason; `matchesInterests: true` leaves `UNREAD` and stores no
reason; a thrown call leaves the article `UNREAD`.

**`tests/integration/feedRepository.test.ts`** — the case at line 95 asserting
regex filtering is replaced by one asserting that `refreshFeed` now persists
every fetched item.

**`tests/unit/feedSchema.test.ts`** — the two regex-validation cases are
removed; `interestProfile` accepts arbitrary text, including text that is not a
valid regular expression.

**`tests/unit/prompts.test.ts`** — `buildLeadPrompt` with an empty profile
produces today's text unchanged, which is the guard on the no-filter path
staying free; with a profile it embeds the profile and asks for a verdict.

**`tests/components/article/dismiss-button.test.tsx`** and
**`article-card-actions.test.tsx`** — fixtures move to `status`. A new case
covers the Keep button appearing for a `FILTERED` article and not otherwise.

**`prisma/seed.ts`** — seeds articles across all four statuses, including a
filtered one with a reason, so `npm run update-screenshots` captures the new
view.

**e2e** — `tests/e2e/article-card.spec.ts` and `navigation-sidebar.spec.ts` do
not exercise generation and need no change beyond any selector affected by the
View relabel.

## Files touched

Changed: `prisma/schema.prisma`, `prisma/seed.ts`, one new migration,
`src/lib/repository/{articleRepository,statsRepository,feedRepository,feedSchema}.ts`,
`src/lib/ai/services/leadService.ts`, `src/lib/ai/prompts.ts`,
`src/components/feed/feed-form.tsx`,
`src/components/article/{article-card,article-card-actions,dismiss-button,toggle-read-later-button}.tsx`,
`src/components/navigation/feed-navigation.tsx`,
`src/app/feed/{page,history/page,read-later/page,no-unread-articles}.tsx`,
`src/app/feed/[feedId]/{page,no-unread-articles}.tsx`,
`src/app/feed/category/[categoryId]/page.tsx`.

Added: `src/components/article/keep-button.tsx`.

Renamed: `src/app/feed/[feedId]/feed-filter-button.tsx` →
`feed-view-button.tsx`.

Deleted: `src/lib/repository/feedFilter.ts`, `tests/unit/feedFilter.test.ts`.
