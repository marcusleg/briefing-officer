# Audio Summary — Design

Date: 2026-08-04

## Summary

Replace the inline Read Aloud button with a dedicated **Audio Summary** page. A
speaker icon on the article card and on the AI Summary page navigates to
`/feed/[feedId]/article/[articleId]/audio-summary`. That page generates a
purpose-written spoken script, streams it in as visible text, and speaks it
sentence by sentence through the Web Speech API while the listener reads along.

## Motivation

The shipped Read Aloud button speaks the article title and its AI lead from the
card. Extending that button to the AI Summary page runs into a format problem:
`buildSummaryPrompt` deliberately produces a **visual** artefact — a `###`
heading, five to twelve terse bullets, a bolded entity per bullet. Bold is
inaudible. Bullets read aloud are disconnected clauses with no transitions.
Stripping the Markdown would paper over a mismatch rather than fix it.

The existing `buildLeadPrompt` already demonstrates the alternative: it produces
flowing prose, which is precisely why Read Aloud sounds acceptable on the card
today. Audio deserves its own script, written for the ear.

A dedicated page also resolves a structural problem. `speechSynthesis` is a
global singleton shared by every mounted card, and `use-speech-synthesis.ts`
currently spends roughly forty lines managing that: a `currentUtterance`
ownership ref, a guarded unmount cancel, and a comment explaining that one
card's dismissal must not silence another card's playback. With exactly one
audio surface mounted at a time, that entire class of problem stops existing
rather than being managed.

Two smaller gains follow. The button today **hides itself** when no speech
engine is present — a silent, confusing failure on Linux without
speech-dispatcher. A page can state the problem. And a page has room for
controls an icon cannot host: pause, restart, and a speech-rate slider.

## Non-goals

- **Persisting the generated script.** It regenerates per visit, matching how
  the AI Summary page already behaves. No Prisma migration.
- **Aborting server-side generation on stop.** `streamAudioScript` runs
  generation in a detached `void (async () => …)()`, so stopping playback stops
  stream consumption but tokens keep billing. Cutting that requires threading an
  `AbortSignal` into `streamText`. The existing `streamAiSummary` has the
  identical issue; fixing both is separate work.
- **Auto-scrolling the transcript** to follow the highlighted sentence. A
  150–200 word script fits roughly one screen, so it solves a problem that
  mostly does not arise, and it needs per-sentence refs plus logic to avoid
  fighting a user who scrolls manually.
- **Voice selection.** Rate is exposed; picking among installed voices is not.
- **Normalising the author value.** Readability's byline is known to be
  unreliable — it can arrive prefixed with "By", or carrying a job title or
  date. The intended fix is to prefer the author supplied by the RSS feed and
  fall back to the byline, which is separate work not yet in place. This feature
  deliberately does **not** clean the value up locally: a second place that
  knows how to tidy bylines would only make that fix harder. Some articles will
  therefore be introduced awkwardly, and will be corrected for free once the
  author-determination change lands.
- **A persistent mini-player.** Docking playback at the bottom of every page
  would preserve feed-skimming, but needs global playback state, a portal, and
  layout changes on every page.

## User-visible behaviour

1. A speaker icon appears in the article card's action row and in the AI Summary
   page's action row. Pressing `a` on the selected card does the same thing.
2. Both navigate to the Audio Summary page for that article.
3. The page shows the feed name, publication time, title, and author — matching
   the AI Summary page header — then the transcript area and transport controls.
4. Playback attempts to start automatically on arrival, opening with a
   constructed introduction — title, author, feed — that is available
   immediately, so audio begins without waiting on the model at all. The
   generated body then streams in as text, each completed sentence beginning to
   speak as it arrives.
5. The sentence currently being spoken is highlighted in the transcript.
6. Transport controls: play/pause, restart, and a speech-rate slider.
7. The configured rate persists across sessions on that device.

## Architecture

### Navigation

`ReadAloudButton` is replaced by `AudioSummaryButton`, mirroring the existing
`AiSummaryButton`: a `Button asChild` wrapping a `Link`. No hook, no `supported`
gate, no tooltip — a link is always safe to render, so the component drops from
58 lines to roughly 20.

This removes three things from the card path:

- The `props.leadText &&` guard, currently duplicated across all three layout
  blocks in `article-card-actions.tsx`.
- The `leadText` prop on `ArticleCardActionsProps`.
- The threading of `aiLead` from `article-card.tsx` into the actions row. The
  lead itself stays — it remains the card's description text. It simply stops
  being spoken.

`ArticleCardActions` currently suppresses one entry via `hideSummarizeButton`,
and now needs to suppress the audio entry on the audio page. Rather than add a
second boolean, replace it with:

```ts
currentPage?: "ai-summary" | "audio-summary";
```

Each page suppresses its own entry. The AI Summary page passes
`currentPage="ai-summary"` and therefore still shows the speaker icon; the Audio
Summary page passes `currentPage="audio-summary"` and still shows Summarize.

A new `a` hotkey in `article-card.tsx` navigates to the audio page, alongside
the existing `s`. Hotkeys `s`, `v`, `m`, `p`, and `n` are taken; `a` is free.

### Route

`src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`, a server
component modelled directly on the sibling `ai-summary/page.tsx`: resolve the
session, load the article with `feed` and `scrape`, `notFound()` when absent.
When `article.scrape` is missing it renders the same "unavailable" `Alert`
pattern, worded for audio. Otherwise it renders the client player and the
actions row.

### The opening line

The script opens with an introduction naming the article, its author, and its
feed. This is **constructed in code, not generated**. Asking the model to open
with specific values invites it to paraphrase the title, drop the author, or
invent one — and the values are already known, so an LLM adds nothing but risk.

`buildOpeningLine(title, author, feedTitle)` is a pure function returning:

```
"{title}. Written by {author}, from {feedTitle}."
"{title}. From {feedTitle}."                        // author missing
```

Terminating the title as its own sentence is deliberate: feed headlines
frequently end in `?` or `!`, and appending a comma to those produces an audible
glitch ("Is Rust dead?, written by…"). Ending the sentence sidesteps the
collision entirely and supplies a natural pause. "From" is used rather than
"at", which would imply employment, and works for aggregator feeds as well as
publications.

The one input case it handles is a **missing author**: `scraper.ts:47` stores
`parsedArticle!.byline ?? ""`, so the author is an empty string whenever
Readability finds no byline, which is common. Without the second form the line
would read "Written by , from Hacker News" — a structural break, not merely an
awkward one. `ArticleMeta` already guards the same way.

Otherwise the `author` value is used **verbatim**, and is assumed to contain
only a name — see the non-goal on normalising it.

Because the opening needs no generation, it is enqueued the moment the page
mounts. Audio starts immediately rather than a second in, and the model gets
that head start to stay ahead of the voice.

### Generation

`buildAudioScriptPrompt(title, textContent)` joins the existing prompts in
`src/lib/ai/prompts.ts`. It produces only the **body** — the opening is handled
above, and the prompt states that the script will already have been introduced,
so it must not restate the title, author, or publication.

It targets 150–200 words, about one minute of speech, and instructs: short
declarative sentences, explicit connectives between them, numbers written as
they are spoken, no parenthetical asides, and — stated explicitly — no Markdown,
no headings, and no bullet lists.

`src/lib/ai/services/audioScriptService.ts` mirrors `summaryService.ts`:
`createStreamableValue`, `streamText` against
`getFirstConfiguredLanguageModel()`, `logger.info` on completion, and
`trackTokenUsage`. It touches no Prisma tables of its own.

### Sentence splitting

`splitIntoSentences(buffer)` joins `buildOpeningLine` in
`src/lib/audio-script.ts` — both are small, pure, script-assembly helpers, and
one module is simpler than two files of a dozen lines each. It returns the
complete sentences found in a buffer plus the unterminated remainder, so it can
be called repeatedly against a growing stream:

```ts
splitIntoSentences("Linux 7.2 drops strncpy. It landed Fri");
// → { sentences: ["Linux 7.2 drops strncpy."], remainder: "It landed Fri" }
```

It must not split on abbreviations (`U.S.`, `Dr.`, `Mr.`, `e.g.`, `i.e.`),
decimals (`3.5%`), or ellipses. Because the highlight makes sentence boundaries
**visible**, a bad split is something the user sees, not merely an odd pause
they hear — so this function carries more weight than it would otherwise and is
unit-tested without a DOM.

### Playback

The player enqueues the constructed opening line first, before generation has
returned anything. It then accumulates stream deltas into a buffer, splits off
whole sentences, and enqueues each as its own `SpeechSynthesisUtterance`.
`speechSynthesis` queues utterances FIFO and plays them back to back, so
playback is gapless. Because models emit far faster than a voice speaks (~150
wpm), and the opening buys several seconds of head start, generation stays ahead
of playback for the rest of the script.

Per-sentence utterances also sidestep Chrome's 15-second truncation bug, which
applies to a single long utterance. A sentence at this length runs about five
seconds.

**Autoplay needs no capability detection.** The transport renders Play whenever
nothing is speaking. If the browser blocks the initial attempt because the page
was hard-loaded without user activation, the control is simply already sitting
at Play. The fallback state and the normal idle state are the same UI.

### The rewritten hook

`use-speech-synthesis.ts` becomes queue-based:

```ts
interface SpeechSynthesisControls {
  activeIndex: number | undefined;
  cancel: () => void;
  enqueue: (sentence: string) => void;
  pause: () => void;
  paused: boolean;
  playFrom: (index: number) => void;
  rate: number;
  resume: () => void;
  setRate: (rate: number) => void;
  speaking: boolean;
  supported: boolean;
}
```

The hook retains every sentence passed to `enqueue`, because `playFrom(index)`
needs to re-speak from an arbitrary point. Ownership of the sentence list
therefore sits in the hook, not the player; the player owns only the streaming
buffer and the splitting.

Changes from the current implementation:

- **The `currentUtterance` ownership ref and the guarded unmount cancel are
  deleted.** Exactly one audio surface can be mounted, so unmount cancels
  unconditionally.
- **The keepalive `pause()`/`resume()` interval is deleted** — subject to
  verification below. Removing it also stops the keepalive fighting the real
  pause control, which would otherwise resume playback the user paused.
- Each utterance's `onstart` sets `activeIndex`. The highlight is therefore
  driven by the engine's own events, not a timer, so it cannot drift out of sync
  with the audio.

**Verification required before deleting the keepalive:** confirm in a real
Chrome session that a full script plays to the end without truncation. The
15-second limit applies per utterance and sentences run well under it, but this
is a browser quirk and is checked rather than assumed. If truncation does occur,
the keepalive stays and must be suspended while `paused` is true.

### Speech rate

A shadcn `Slider` (already vendored at `src/components/ui/slider.tsx`;
`@radix-ui/react-slider` is already a dependency) next to the transport
controls. Range 0.5×–2.0×, step 0.1, default 1.0×, current value shown
numerically. The Web Speech spec permits 0.1–10, but most engines clamp or
garble above 2×, so the wider range is not exposed.

Persistence is **localStorage**, not the database:

- The app has no preferences concept — no settings model, no existing
  `localStorage` use, no settings page. Adding a model, repository, server
  action, and migration for one slider is disproportionate.
- The `User` model is Better Auth-managed (`@@map("user")`), so a rate column
  would put application state in an auth-owned table.
- Speech rate is genuinely device-specific. Rate `1.4` on Chrome's remote voices
  and on Linux espeak are audibly different speeds, so a synced value would
  arrive wrong on a second device.
- Theme is already a client-held preference via `@wrksz/themes`, so client-side
  persistence has precedent.

The stored value is read **in an effect**, not during render, so the server and
first client render agree on the 1.0× default and hydration does not mismatch.

**Applying a rate change mid-playback:** `SpeechSynthesisUtterance.rate` is read
at `speak()` time, so a change cannot affect utterances already queued. Left
alone the slider would appear broken while playing. `setRate` therefore handles
this inside the hook: when something is speaking, it cancels the queue and
re-enqueues from `activeIndex` at the new rate. The current sentence restarts
from its beginning, which reads as intentional rather than as a glitch. When
nothing is speaking, `setRate` only stores the value. The player just moves the
slider; it never re-enqueues.

This is the same operation as **restart** — "re-enqueue from index _n_" — so
both controls share `playFrom(index)` rather than adding a second code path.

## Failure modes

| Condition           | Behaviour                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `article.scrape` | "Audio summary unavailable" `Alert`, matching the AI Summary page's pattern. No generation is attempted.                                                                                        |
| No speech voices    | An `Alert` states that the browser has no speech voices installed. The transcript still streams and renders, so reading still works.                                                            |
| Autoplay blocked    | Transport sits at Play. No special-case UI.                                                                                                                                                     |
| Navigation away     | Unmount cancels playback unconditionally.                                                                                                                                                       |
| Generation error    | The stream ends; whatever was spoken has been spoken. The constructed opening always plays, so the listener at least hears what the article was. Surfaced through the existing service logging. |
| Missing author      | The opening drops the attribution clause rather than speaking an empty name.                                                                                                                    |

The no-voices case is a strict improvement on today's behaviour, where the
button silently renders nothing and the user has no way to know why.

## Testing

New:

- `splitIntoSentences` — abbreviations, decimals, ellipses, incremental feeding
  of a growing buffer, empty and whitespace-only input. Pure unit tests, no DOM.
- `buildOpeningLine` — author present, author empty, and titles ending in `?`,
  `!`, or a period. The author is passed through verbatim; there is no
  normalisation to test.
- The queue hook — enqueue ordering, `activeIndex` driven by `onstart`,
  pause/resume, cancel, `playFrom(index)`, and that `setRate` re-enqueues from
  the active index with the new rate applied.
- The player — speaks the opening before any delta arrives, streams deltas into
  sentences, highlights the active one, transport controls behave, and the rate
  slider persists to and restores from `localStorage`.
- `AudioSummaryButton` — renders a link to the correct href. Much smaller than
  the test it replaces.

Updated:

- `article-card-actions.test.tsx` loses its `leadText` dependency and gains
  coverage of `currentPage` suppression.
- `tests/helpers/speech-synthesis.ts` grows `onstart` firing, queue tracking,
  and `rate` capture on the fake utterance.

Deleted:

- `tests/components/article/read-aloud-button.test.tsx`, superseded by the
  `AudioSummaryButton` link test.

## Files

| Action | Path                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Add    | `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`                                                                 |
| Add    | `src/components/article/audio-summary-player.tsx`                                                                                  |
| Add    | `src/components/article/audio-summary-button.tsx`                                                                                  |
| Add    | `src/components/article/audio-summary-article-actions.tsx`                                                                         |
| Add    | `src/lib/ai/services/audioScriptService.ts`                                                                                        |
| Add    | `src/lib/audio-script.ts` — `buildOpeningLine`, `splitIntoSentences`                                                               |
| Edit   | `src/lib/ai/prompts.ts` — add `buildAudioScriptPrompt`                                                                             |
| Edit   | `src/hooks/use-speech-synthesis.ts` — rewrite as a queue                                                                           |
| Edit   | `src/components/article/article-card-actions.tsx` — swap button, replace `hideSummarizeButton` with `currentPage`, drop `leadText` |
| Edit   | `src/components/article/article-card.tsx` — drop `leadText`, add `a` hotkey                                                        |
| Edit   | `src/components/article/ai-summary-article-actions.tsx` — pass `currentPage`                                                       |
| Delete | `src/components/article/read-aloud-button.tsx`                                                                                     |
