# Article Status and AI Filtering — Design

Date: 2026-08-12

## Summary

Replace the article's `readAt` / `readLater` pair with a single
`status ArticleStatus` column, and add two states for articles that do not
belong in the inbox on relevance grounds: `FILTERED`, where a language model
judged the article to be of no interest, and `NOT_INTERESTED`, where the reader
said so by hand. The model's judgement is made per feed, against a free-text
interest profile the reader writes, and it is produced as extra
structured-output fields on the lead generation call that already runs for every
new article. Both kinds are kept, hidden from the inbox, and reviewable behind a
new option in the feed page's view selector, where the reason is shown and the
article can be pulled back into the inbox.

Keeping the two apart is what makes the model's precision measurable, and
recording the reader's own rejections is what will later let the filter learn
from them.

The regex-based `Feed.titleFilterExpressions` feature is removed. Its contents
migrate into the new interest profile so no reader's intent is silently lost.

## Motivation

Three problems, one change.

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

**`readAt` cannot distinguish satisfaction from rejection.** A dismissed article
is recorded identically whether the reader got what they needed from the lead or
wanted the item off their screen unread. Those are opposite outcomes, and the
one the application most needs to know about — rejection — is the one it never
records. Everything downstream inherits the conflation: the read-per-day chart
counts an annoyed dismissal as a read, and a filter meant to learn what the
reader dislikes has no source of that information other than its own past
verdicts.

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
  `UNREAD`, `READ`, or `READ_LATER`; neither rejection state is ever assigned by
  the migration.
- **Re-judging an article when its feed's interest profile changes.** The
  verdict is made once, at ingest. Editing a profile affects articles fetched
  afterwards. Articles already filtered stay filtered until the reader pulls
  them back.
- **Learning from the reader's corrections.** This design _collects_ the signals
  a feedback loop would need — `filterReason` survives an article being pulled
  back out of `FILTERED`, and `NOT_INTERESTED` records an explicit rejection —
  but nothing reads them back into the prompt, and no interest profile is ever
  rewritten automatically. The loop is a separate feature built on the data this
  one starts gathering. Collecting without consuming is deliberate; see
  "Decisions and their alternatives".
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
| → `NOT_INTERESTED`    | set to now                   | none — the reader rejected it rather than reading it          |

The one row where behaviour differs is `READ` → `READ_LATER`, which is the
double-listing bug being fixed.

This guarantee holds only while nothing writes `statusChangedAt` outside a
status change, so that is enforced structurally rather than by convention — see
"Writing the status".

**`NOT_INTERESTED` is a distinct state, and the signal is collected explicitly
rather than inferred.** `READ` conflates two different things: the reader was
satisfied, and the reader wanted the item gone. The AI filter needs to tell them
apart, and the negative half is the scarcest label in the system — positive
signals are abundant (star, read-later, visiting the link, generating a summary,
pulling an article back out of `FILTERED`) while the only negative currently
obtainable is the filter's own verdict, which is circular.

Inferring the distinction from behaviour was considered and rejected on a
property specific to this application: the lead is the product. The most common
successful interaction is reading the AI lead and dismissing without opening
anything, so any behavioural inference labels the app's core value as
disinterest. The bias is systematic, not noise, which is what rules the approach
out rather than merely weakening it.

Splitting `DismissButton` into two co-equal buttons was also rejected. Dismissal
is the highest-frequency action in the application, and forcing a classification
on every one of them taxes the common path to capture a label that only matters
in the minority case. A low-prominence icon action collects the signal when the
reader feels strongly enough to reach for it, which is when the signal carries
information.

Folding "not interested" into `FILTERED` with a user-authored `filterReason` was
rejected for one reason: the reader's own rejections would then be
indistinguishable from the model's, and the model's precision would stop being
measurable. The review view merges the two states; the data keeps them apart.

The collection begins now even though nothing consumes it, because the two costs
are asymmetric. Adding a fifth enum member later is additive and non-breaking,
so the schema change is cheap to defer — but every dismissal made before the
column exists is unlabelled and unrecoverable. Deferring costs data, not work.

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
  FILTERED // the model kept it out
  NOT_INTERESTED // the reader rejected it by hand
  READ
}

model Article {
  // replaces readAt and readLater
  status          ArticleStatus @default(UNREAD)
  statusChangedAt DateTime      @default(now())
  filterReason    String?
  starred         Boolean       @default(false) // unchanged
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

`unmarkArticleAsRead` is renamed `restoreArticleToInbox`, because it is now the
single way back to `UNREAD` from any of `READ`, `FILTERED`, and
`NOT_INTERESTED`, and "unmark as read" describes only the first. It leaves
`filterReason` untouched.

One genuinely new exported action, `markArticleAsNotInteresting`, moves an
article to `NOT_INTERESTED`. No `keepArticle` action is added — pulling a
filtered article back is the same transition as un-reading a read one, so it is
the same call.

`deleteArticlesOlderThanXDays` keeps its meaning: its
`readLater: false, starred: false` predicate becomes
`status: { not: READ_LATER }, starred: false`, so both rejection states are
swept with the rest.

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
| `components/article/article-card.tsx:79`          | `readAt !== null` (`m` hotkey)           | `status !== "UNREAD"`                       |
| `components/article/article-card.tsx:110`         | `readAt !== null` (dimming)              | `status !== "UNREAD"`                       |
| `components/article/dismiss-button.tsx:46`        | `readAt !== null`                        | `status !== "UNREAD"`                       |
| `components/article/toggle-read-later-button.tsx` | `readLater`                              | `status === "READ_LATER"`                   |

Three of those are `!== "UNREAD"` rather than `=== "READ"`, and the distinction
matters. The `m` hotkey, the dimming, and the Dismiss/Restore label all ask "is
this out of my inbox", not "was this read" — a filtered or rejected article
should be dimmed and should offer Restore, exactly as a read one does. Writing
them as `=== "READ"` would compile and would be wrong in the new view.

`statsRepository.ts:121` gains a second improvement from the split: keyed to
`status: READ`, the read-per-day chart now excludes hand-rejected articles,
where today every dismissal counts as a read regardless of whether the reader
engaged with it.

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

| Option         | `show`             | Predicate                                    |
| -------------- | ------------------ | -------------------------------------------- |
| All articles   | `all`              | `status: { in: [UNREAD, READ] }`             |
| Unread only    | `unread` (default) | `status: UNREAD`                             |
| Not interested | `rejected`         | `status: { in: [FILTERED, NOT_INTERESTED] }` |

"All articles" continues to exclude `READ_LATER`, as it does today, and now also
excludes both rejection states: they surface only when explicitly asked for,
which is the entire point of keeping them out.

The third view is labelled **Not interested** rather than "Filtered out" because
it holds both members: articles the model kept out, and articles the reader
rejected by hand. From the reader's side those are one category — "things that
did not belong in my inbox" — differing only in who decided. Each card states
which: the model's `filterReason`, rendered as muted text near the lead in the
article's language, or "You marked this as not interesting."

No new button is needed for pulling one back. `ArticleCardActions` already
renders `DismissButton` for every article in every list, and that button's
condition becomes `status === "UNREAD"` rather than `readAt !== null`, so it
renders **Restore** for anything out of the inbox — read, filtered, or rejected
— and calls the one action that returns an article to `UNREAD`.

This is worth stating plainly because it is a place the status column earns its
keep rather than merely permitting the feature: under `readAt` the same
component would render the **wrong** button here, since `readAt` is null for a
filtered article and the card would offer "Dismiss" for something already out of
the inbox.

## The "not interested" action

A new `not-interested-button.tsx`, rendered in the `IconActions` cluster in
`article-card-actions.tsx` alongside star and read-later — an icon button with a
tooltip, not a labelled one. It calls `markArticleAsNotInteresting` and is
suppressed when the article is already in either rejection state.

"Dismiss" keeps its current prominence, wording, and behaviour. The two actions
are deliberately not peers: dismissing is what the reader does dozens of times a
session, rejecting is what they do when something annoys them.

### Undo, which is currently wrong

`DismissButton`'s toasts offer Undo, and the two handlers are hardcoded inverses
— undoing "marked as unread" calls `markArticleAsRead`. That is already slightly
wrong and this design would make it visibly so: restoring a filtered article and
pressing Undo would land it on `READ` rather than back on `FILTERED`.

The fix is to capture `article.status` before the write and have Undo restore
that captured value rather than assuming the opposite of the action just taken.
The same applies to the new rejection action, whose toast offers the same Undo.
With `setArticleStatus` taking an arbitrary target this is a few lines, and it
makes Undo mean undo for every transition rather than for the two it was written
against.

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
- `restoreArticleToInbox` returns an article to `UNREAD` from each of `READ`,
  `FILTERED`, and `NOT_INTERESTED`, and leaves `filterReason` set in the
  `FILTERED` case. Parameterised over the three, since the whole point is that
  one call serves all of them.
- `markArticleAsNotInteresting` moves `UNREAD` to `NOT_INTERESTED` and does not
  set `filterReason` — the reason column belongs to the model, and a hand
  rejection needs no stated reason.

**`tests/integration/statsRepository.test.ts`** — updates for the new column,
and its unread-per-feed case becomes a regression test for the
`statsRepository.ts:39` bug: a read-later article must not be counted as unread.
A second case asserts the read-per-day chart counts a `READ` article and not a
`NOT_INTERESTED` one, which is the behaviour the fifth member buys.

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

**`tests/components/article/dismiss-button.test.tsx`** — fixtures move to
`status`, and the button renders "Restore" for each of `READ`, `FILTERED`, and
`NOT_INTERESTED` and "Dismiss" only for `UNREAD`. Plus the Undo fix: dismissing
a `FILTERED` article and pressing Undo returns it to `FILTERED`, not `READ`.
That last case is the one that would have shipped broken.

**`tests/components/article/article-card-actions.test.tsx`** — fixtures move to
`status`; the "not interested" action renders for an inbox article and is
suppressed for one already rejected.

**`prisma/seed.ts`** — seeds articles across all five statuses, including a
filtered one with a reason and a hand-rejected one without, so
`npm run update-screenshots` captures the new view with both kinds in it.

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

Added: `src/components/article/not-interested-button.tsx`. No `keep-button.tsx`
— the existing `DismissButton` covers pulling an article back.

Renamed: `src/app/feed/[feedId]/feed-filter-button.tsx` →
`feed-view-button.tsx`.

Deleted: `src/lib/repository/feedFilter.ts`, `tests/unit/feedFilter.test.ts`.
