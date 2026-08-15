# Feed Filter Keywords — Design

Date: 2026-08-15

## Summary

Replace the free-text `Feed.interestProfile` with two per-feed lists of
keywords: things the reader wants from the feed, and things they do not. The
lists coexist rather than being mutually exclusive, and conflicts between them
are settled by specificity — the narrower entry wins, whichever list it came
from. This is what lets a reader say "kernel development, but not USB drivers"
and "no politics, except Faroese politics" with the same mechanism.

The "not interested" button, which today only sets
`ArticleStatus.NOT_INTERESTED` and stops there, becomes the entry point to that
mechanism. Clicking it dismisses the article and opens a popover offering three
model-generated keyword suggestions at different breadths, alongside an
always-available free-text field, all of which write into the feed's disinterest
list.

`ArticleStatus.NOT_INTERESTED` is removed along the way. Once a rejection
teaches the filter a keyword, a status recording that the reader rejected
something has nothing left to say that `FILTERED` plus `filterReason` does not,
and the state it existed to enable is now reached through the keyword instead.

Every feed starts with "advertisements" and "sponsored posts" in its disinterest
list, seeded as ordinary rows so the reader can delete them.

## Motivation

The interest profile is one release old and already has two problems.

**It is a wall of prose that the model must first interpret before it can
apply.** The prompt currently spends a paragraph teaching the model to read the
profile for its polarity, because "everything except X" and "only X" are
expressed in the same field and distinguished only by wording. That paragraph
exists because an earlier version got the polarity backwards and filtered
articles for failing to match a profile that was written as an exclusion list.
Structure removes the ambiguity at the source: two lists cannot be misread for
each other.

**The "not interested" button is a dead end.** It records a rejection that
nothing ever consumes. The reader tells the application, article by article,
exactly what they do not want, and the filter — the one component that would
benefit — never learns any of it. The previous design anticipated this,
recording rejections separately from filter verdicts precisely so the filter
could later learn from them. This is that later.

The two problems have one solution: give the rejections somewhere structured to
go.

## Goals

- Two per-feed keyword lists, replacing the free-text profile.
- Entries may contain spaces and full sentences; they are not single words
  despite the name.
- A single, statable rule for how the lists interact, covering the case where
  one entry is a narrower version of another.
- The "not interested" button writes into the disinterest list, with model-
  generated suggestions and an always-available manual input beside them.
- Sensible defaults, deletable.
- One terminal state for rejected articles instead of two.

## Non-goals

- **Global or cross-feed lists.** Lists are per feed, as the interest profile
  was. A reader who wants "no crypto" on five feeds types it five times. This is
  a plausible follow-up, and deferring it means the follow-up can be designed
  against real evidence of which entries actually get retyped.
- **Re-filtering articles already fetched.** Adding a keyword affects future
  articles only. Re-evaluating a feed's unread articles on every list change is
  a second filtering path, with its own cost model and its own failure modes,
  bought for a convenience available by waiting for the next refresh.
- **Suggestions for the interest list.** The popover writes disinterests only.
  It is reached by rejecting an article, and there is no coherent interest to
  infer from a rejection.
- **Migrating existing profile prose.** See "Migration".

## Decisions and their alternatives

### Specificity decides conflicts, not list precedence

The rule the model applies, in order:

1. If only one list speaks to the article, that list decides.
2. If both speak to it and one is a narrower case of the other, the narrower
   entry decides — regardless of which list it is in.
3. If both speak to it independently, neither refining the other, exclude.
4. If neither speaks to it: keep when the interest list is empty, exclude when
   it is not.

Clause 2 is the whole point. Two reader-supplied examples motivated it, and they
pull in opposite directions under any fixed precedence:

- Interest "Linux Kernel Development", disinterest "USB driver development". The
  disinterest is narrower, so an article about USB drivers is excluded.
- Disinterest "politics", interest "politics in the Faroe Islands". The interest
  is narrower, so a Faroese politics article is kept.

A rule of the form "disinterests always win" satisfies the first and breaks the
second. "Interests always win" does the reverse. Specificity satisfies both and
is one sentence long.

Clause 3 covers the case clause 2 does not: interest "AI", disinterest "press
releases", article an AI press release. Neither entry is a narrower case of the
other, and the article genuinely is a press release, so the explicit rejection
stands.

Clause 4 alone produces the "only…" behaviour. There is no mode flag anywhere in
the design; the presence of interest entries is the mode.

**Alternative rejected: an explicit mode selector.** A control reading
"Everything except… / Only…" makes the mode stored rather than derived, at the
cost of a third control and states where the mode and the lists disagree — mode
"Only" with an empty interest list has no defined meaning. The derived mode
cannot enter such a state.

**Alternative rejected: supporting only "everything except…" or "only…", one at
a time.** Considered for simplicity, and rejected on three grounds. Both
motivating examples above need both lists, so the simplification drops the cases
that prompted the feature. It does not save much — a mode and a list still have
to be stored, two controls still rendered, roughly four sentences of prompt
saved. And it breaks the button: pressing "not interested" on a feed in "only…"
mode has nowhere to write. Every repair for that is worse than the problem —
disabling the button based on configuration the reader cannot see from the
article, folding the exclusion into an interest entry as prose (which is the
free-text field this design removes, returning by the back door), or silently
switching the feed to two lists, which is this design, discovered at a confusing
moment.

Under the design as specified, the button has one behaviour and it never depends
on the feed's configuration: append to the disinterest list.

### A relation table, not JSON columns

Prisma's SQLite connector does not support lists of primitive types — `String[]`
fails schema validation with
`The current connector does not support lists of primitive types`. So "an array"
is either a `Json` column or a relation. This design takes the relation, for
three reasons.

`@@unique([feedId, kind, text])` deduplicates in the database. Entries arrive
from three paths — seeded defaults, the popover, and manual entry in the feed
form — so duplicates are a matter of time, and the alternative is hand-written
deduplication on every write path.

Writes from the popover are single-row inserts that never read the current list
first. With a JSON column every addition is a read-modify-write, so two popovers
used in quick succession on different articles of the same feed can lose one
another's entry. Rows cannot. This advantage is narrower than it first appears —
it does not extend to a feed edit dialog saving over a popover addition, which
is lost under either storage choice, and is accepted under "Error handling".

`Prisma.JsonValue` is not a usable type. Every read would need a Zod parse to
recover `string[]`, which is a translation layer written by hand for each call
site. The relation gives a generated `FeedFilter` type instead.

The cost is a join. `generateAiLead`'s `include: { feed: true, scrape: true }`
becomes `include: { feed: { include: { filters: true } }, scrape: true }`.

### The popover opens on click, and the dismissal commits first

Clicking "not interested" sets `FILTERED` immediately, then opens the popover.
Dismissing the popover with Escape leaves the article dismissed and teaches the
filter nothing — the popover is about the filter, never about the article, so
closing it cannot lose the reader's action.

**Alternative rejected: keeping the dismissal a single instant click, with the
suggestion flow behind a "teach the filter" action on the undo toast.** It
preserves the fast path and defers the model call until the reader opts in,
which would cost nothing on the majority of dismissals. It was rejected on the
explicit ground that control over what gets filtered matters more than friction
on the common case. Toast actions are also transient: look away and the chance
to teach is gone.

The accepted cost is a model call and a decision on every dismissal.

### `ArticleStatus.NOT_INTERESTED` is removed

Reader rejections become `FILTERED`, the same state a model verdict produces,
with `filterReason` carrying "You marked this as not interested."

The previous design gave two reasons for keeping the two states apart: recording
rejections separately "is what will later let the filter learn from them", and
"keeping the two apart is what makes the model's precision measurable". This
design consumes the first — the learning signal is now the keyword the reader
writes at rejection time, not the status left behind, and a rejection that
teaches a keyword needs no separate state to be useful later.

The second reason is not consumed, and removing the state costs it. See
"Accepted regressions".

With the state gone, a reader rejection and a model verdict differ only in what
`filterReason` says, which is what the Filtered view was already showing.

## Accepted regressions

**The rejected-articles chart loses its split.** `shapeRejectedArticlesPerDay`
currently returns `{ date, filtered, notInterested }` and the chart stacks the
two, so the total answers "how much never reached me" while the lower segment
alone shows how the filter itself is doing. With one status there is nothing to
split on, so the chart becomes a single series and that second reading is gone.
It shipped one release ago, in d9b0329.

What is lost specifically is the answer to "how often does the filter miss
something I then have to reject by hand" — the one number that says whether the
keyword lists are working. Nothing in this design replaces it.

There is a natural replacement, and it is deliberately not in scope here:
`FeedFilter.createdAt` makes "keywords added per day" available, which measures
teaching events rather than rejections and is arguably the better signal for
keyword-based filtering. Charting it is a separate change against a table that
does not exist yet.

## Schema

```prisma
enum FeedFilterKind {
  INTEREST
  DISINTEREST
}

model FeedFilter {
  id        Int            @id @default(autoincrement())
  feedId    Int
  feed      Feed           @relation(fields: [feedId], references: [id], onDelete: Cascade)
  kind      FeedFilterKind
  text      String
  createdAt DateTime       @default(now())

  @@unique([feedId, kind, text])
}
```

`Feed` loses `interestProfile String @default("")` and gains
`filters FeedFilter[]`.

`ArticleStatus` loses `NOT_INTERESTED`, leaving `UNREAD`, `READ_LATER`,
`FILTERED`, `READ`.

`DISINTEREST` is retained as the internal name for symmetry with `INTEREST`,
notwithstanding that "disinterest" strictly means impartiality. The user-facing
labels are "Interested in" and "Not interested in", which match the button that
feeds the second list.

## Migration

`replace_interest_profile_with_feed_filters`:

1. Create the `FeedFilter` table.
2. Insert `DISINTEREST` rows for "advertisements" and "sponsored posts" against
   every existing feed.
3. Drop `Feed.interestProfile`.
4. Backfill `filterReason` with "You marked this as not interested." for every
   article whose status is `NOT_INTERESTED` and whose `filterReason` is null,
   then set those articles' status to `FILTERED`.

Step 4 runs in that order deliberately: the reason must be written before the
status that identified those rows is overwritten, or the rows can no longer be
found. SQLite stores the enum as `TEXT` with a check constraint, so the data
migration has to precede the constraint change within the same migration.

Existing profile prose is not converted. There is no honest automatic
translation from a paragraph into two keyword lists, and the two alternatives
are both worse than the loss. A model-driven conversion would run unattended
during someone's upgrade and produce plausible-looking output that nobody
verifies. Keeping the column as a third input means maintaining two filtering
mechanisms and a prompt that reconciles them, which is the opposite of the
change's purpose.

This is a user-visible loss and belongs in the release notes: readers who wrote
an interest profile re-enter it as keywords.

## Defaults

New feeds are seeded in `createFeed` with the same two `DISINTEREST` rows as the
migration inserts.

They are data, not code, so they are deletable. A default that cannot be removed
is a policy, and this one is only a good guess.

**Consequence, stated because it is easy to miss:** filtering is now on for
every feed out of the box. Previously an empty interest profile meant no
relevance directive and the cheaper `leadSchema` path; now every feed pays the
filtering prompt and its reasoning tokens on every article. Deleting both
defaults returns a feed to the unfiltered path, but the default is on.

## Filtering at ingest

`relevanceDirective` changes signature from a single string to two arrays:

```ts
const relevanceDirective = (interests: string[], disinterests: string[]) => …
```

Plain arrays rather than `FeedFilter[]`. `src/lib/ai/prompts.ts` imports nothing
but `languageDisplayName` today and its tests are correspondingly trivial;
passing generated Prisma types would couple the module to the client and force
every prompt test to construct rows with `id`, `feedId`, and `createdAt` that
the function never reads. `leadService` partitions `feed.filters` at the call
site, where the Prisma object is already in hand.

The directive renders only the non-empty lists:

```
<reader_interests>
- Linux Kernel Development
</reader_interests>

<reader_disinterests>
- USB driver development
- advertisements
</reader_disinterests>
```

followed by the four clauses. Clause 4 renders conditionally — only the sentence
matching the current list state — so the model is not reasoning about a branch
that cannot fire. The paragraph teaching the model to read the profile for its
polarity is deleted; structure has replaced it.

Filtering is active when either list is non-empty. When both are empty,
`generateAiLead` takes the existing `leadSchema` path unchanged.
`filteringLeadSchema` is unchanged, including the ordering of `exclusionReason`
before `excludeArticle` and the reasoning recorded in its comments, which
remains accurate.

## Feed form

The `Textarea` is replaced by two instances of a new `KeywordListField`
(`src/components/feed/keyword-list-field.tsx`): removable badges above an input
that commits on Enter. It trims, rejects empty input, and deduplicates
case-insensitively against the entries already present. Spaces are permitted, as
are full sentences.

Beneath both fields, a live description generated by a pure
`describeFilters(interests, disinterests)`:

| interests | disinterests | rendered                                                          |
| --------- | ------------ | ----------------------------------------------------------------- |
| empty     | empty        | No filtering — every article from this feed is kept.              |
| empty     | set          | Everything except _advertisements_, _sponsored posts_.            |
| set       | empty        | Only _Linux Kernel Development_.                                  |
| set       | set          | Only _Linux Kernel Development_, except _USB driver development_. |

The description exists because the mode is derived rather than selected. Adding
a first interest entry silently narrows the feed from everything to only that,
which is the one sharp edge in the derived-mode design; a sentence the reader
reads before saving is what turns it from a surprise into a choice.

`feedSchema` gains `interests` and `disinterests`, both
`z.array(z.string().trim().min(1)).default([])`. `createFeed` and `updateFeed`
replace the feed's filter set inside a transaction: `deleteMany` for the feed,
then `createMany`.

## The "not interested" popover

`NotInterestedButton` becomes a popover trigger. On click it calls
`markArticleAsNotInteresting` as it does today, then opens.

`markArticleAsNotInteresting` keeps its name — it is still what the reader is
expressing — but now sets `FILTERED` and writes `filterReason`. `filterReason`
is not part of `setArticleStatus`'s signature, so this becomes the second write
to bypass the chokepoint, after the one in `generateAiLead`. Rather than add a
third exception later, `setArticleStatus` takes an optional `filterReason` and
both callers go through it.

The popover header carries "Marked as not interested" and an Undo for the
dismissal — relocated from the toast rather than removed, because the dismissal
is a single-step action that can be hit by accident, and firing a toast beneath
an open popover is noise. Adding a filter entry has no undo: it is a two-step
action, and the entry can be removed from the badge list.

A footer line reads "Applies to future articles", which is true and otherwise
non-obvious.

### Suggestions

A `suggestFilterKeywords(articleId)` server action calls `generateObject` with:

```ts
z.object({ suggestions: z.array(z.string()).length(3) });
```

Input is the article title, its stored `ArticleLead.text` where present and
`description` otherwise, and the feed's existing disinterest entries so the
model does not re-propose one already present. Not the full scrape: for naming
what an article is about, eighty words suffice, and the ingest call has already
paid for the long-form read.

The three suggestions are requested at **different breadths** — narrow, medium,
broad. This follows directly from specificity deciding conflicts: an entry's
breadth determines what it will and will not catch, so offering only near-
synonyms would waste two of the three. For an article on a USB driver bug: "USB
driver development", "device drivers", "kernel subsystem internals".

Suggestions are written in the lead's language, consistent with
`exclusionReason`. Token usage is recorded through `trackTokenUsage`.

### Rendering

The popover has two parts, and the second is always present.

**Suggestions**, when available: three chips, inserted on click,
multi-selectable, showing an added state. A skeleton occupies their place while
generating.

**A free-text keyword input**, unconditionally. It is the same
`KeywordListField` input the feed form uses, and it is rendered in every state
of the popover — while the suggestions are still generating, after they arrive,
when the reader has already accepted one or more of them, and when there are no
suggestions at all. It is not a fallback shown only when the model path fails. A
reader who wants to type "quarterly earnings roundups" instead of picking a chip
can always do so, and can do it without waiting for the generation to finish.

The three states of the suggestion area, then, are: generating (skeleton),
generated (chips), and unavailable (a quiet note, when no model is configured or
the call failed). The input sits below all three, unchanged.

The point is that a reader who can reach the model is never obliged to wait for
it or to use what it offers — the input is live from the moment the popover
opens, and a generation that fails degrades to a note rather than to a dead end.

What this does **not** claim is that the popover works with no AI provider
configured at all. It does not: the suggestion service resolves its model at
module scope, so importing it throws, and the component cannot render. That is
accepted. This application depends on a language model throughout — without one,
most of it is already broken — so it is reasonable for this feature to go with
it, provided a configured-but-failing model degrades gracefully. That is the
case the three states above cover.

The popover writes `DISINTEREST` rows only.

## Error handling

- `suggestFilterKeywords` failing is not an error the reader must act on. The
  suggestion area degrades to the note described above; the dismissal has
  already been committed and the manual input, being unconditional, is
  unaffected.
- Adding an entry that already exists is not an error either. The unique
  constraint makes the insert idempotent; the UI shows the entry as present.
- A feed edit saved while a popover added an entry: the form submits the list as
  it looked when the dialog loaded, and `updateFeed` replaces the whole set, so
  the popover's entry is lost. Accepted, and not a consequence of the storage
  choice — a JSON column loses it identically, and diffing rather than replacing
  would not help, since the form's submitted list is itself stale. The dialog is
  short-lived, the loss is one keyword, and the alternative is merge logic for a
  race that requires two concurrently open views of the same feed.

## Testing

Extend `tests/unit/prompts.test.ts`: both lists rendered, empty lists omitted
entirely, the correct clause-4 sentence selected for each list state.

New unit tests for `describeFilters` across all four rows of the table above,
and for the schema's trimming, empty rejection, and case-insensitive
deduplication.

Integration tests for filter set replacement in `updateFeed`, the seeded
defaults in `createFeed`, and cascade deletion with the feed. In
`tests/integration/leadService.test.ts`, cover the branch between the filtering
and non-filtering schemas as the lists change.

A component test for the popover following the existing
`tests/components/article/` pattern: dismissal commits on open, chips insert on
click, and the manual input is present and usable in all three suggestion states
— generating, generated, and unavailable — not merely when suggestions fail.

The existing tests that enumerate statuses need narrowing rather than deleting:
`tests/unit/article.test.ts`, `tests/integration/articleRepository.test.ts`, and
`tests/components/article/dismiss-button.test.tsx` all iterate
`["READ", "FILTERED", "NOT_INTERESTED"]`, and
`tests/unit/statsTransforms.test.ts` and
`tests/integration/statsRepository.test.ts` assert the two-series shape
throughout. Their assertions about `FILTERED` still hold and should survive the
edit intact; only the `NOT_INTERESTED` arm and the `notInterested` field go.

The four arbitration clauses are model behaviour rather than code paths.
Asserting them against a mocked model would prove only that the mock returns
what it was told to. They are verified by hand against the seed data, and
regressions in them will surface as filtering complaints rather than as red
tests. This is a known gap, not an oversight.

## Files touched

Keyword lists:

- `prisma/schema.prisma` — `FeedFilterKind`, `FeedFilter`, `Feed.filters`, drop
  `Feed.interestProfile`
- `prisma/migrations/<ts>_replace_interest_profile_with_feed_filters/`
- `prisma/seed.ts` — seed data updated for the new shape
- `src/lib/ai/prompts.ts` — `relevanceDirective` signature and body
- `src/lib/ai/services/leadService.ts` — partition `feed.filters`, widen the
  `include`
- `src/lib/ai/services/filterSuggestionService.ts` — new
- `src/lib/repository/feedSchema.ts` — `interests`, `disinterests`
- `src/lib/repository/feedRepository.ts` — set replacement, seeded defaults
- `src/lib/feedFilters.ts` — `describeFilters`, new; sits beside `language.ts`
  rather than under `repository/`, being display text over plain arrays with no
  database involvement
- `src/components/feed/keyword-list-field.tsx` — new
- `src/components/feed/feed-form.tsx` — replace the textarea
- `src/components/article/not-interested-button.tsx` — popover

Removing `NOT_INTERESTED`:

- `prisma/schema.prisma` — drop the enum member
- `src/lib/repository/articleRepository.ts:143` — `markArticleAsNotInteresting`
  sets `FILTERED` with a reason; `setArticleStatus` gains the optional
  `filterReason`
- `src/lib/article.ts:26` — the `isInInbox` comment names the terminal states
- `src/components/article/article-card.tsx:145–152` — the reason block collapses
  to a single `FILTERED` branch. Its current fallback for a `FILTERED` article
  with no `filterReason` reads "You marked this as not interesting.", which was
  already wrong — that branch is a model verdict, not a reader one — and becomes
  conspicuously so once reader rejections always carry a reason. Replace it with
  wording that fits an unexplained model verdict.
- `src/components/article/article-card-actions.tsx:47` — the guard becomes
  `status !== "FILTERED"`
- `src/lib/repository/statsTransforms.ts` — `RejectedArticlesRow` loses
  `notInterested`; the doc comment explaining the split goes with it
- `src/app/feed/daily-filtered-articles-chart.tsx` — one series
- `src/lib/repository/statsRepository.ts:143,155,169` — single status
- `src/app/feed/filtered/page.tsx:27`, `src/app/feed/[feedId]/page.tsx:47` —
  `status: "FILTERED"`

Tests as enumerated above.
