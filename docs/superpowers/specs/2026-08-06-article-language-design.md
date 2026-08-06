# Language-Aware Article Processing — Design

Date: 2026-08-06

## Summary

Record the language of each article and state it explicitly in every prompt, so
a German article produces a German lead, a German text summary, and a German
audio briefing spoken by a German voice. The language is determined once, by the
model, as structured output alongside the lead that is already generated for
every article at ingest. It is stored on the article and read by everything
downstream.

## Motivation

Nothing in the pipeline currently states what language the generated text should
be in, so the model infers it from the source. The same feed can produce output
in the article's language one day and in English the next.

Read Aloud compounds this. `useSpeechSynthesis` never sets `utterance.lang` and
never selects a voice, so the browser reads every briefing with its default —
usually English — voice. A German briefing spoken with English phonetics is hard
to follow. The spoken introduction assembled by `buildOpeningLine` is English by
construction: "Written by …, from …".

## Goals

- A non-English article produces its lead, text summary, and audio briefing in
  its own language.
- The output language is a recorded property of the article, not something that
  emerges from the model's guesswork.
- Read Aloud pronounces a briefing in the language it is written in.

## Non-goals

- **Translating the application's interface.** Buttons, headings, navigation,
  and error messages stay English. This feature is about the article's content,
  not the reader's UI locale.
- **A reader-facing language override.** Neither per-feed nor per-article.
  Detection plus the English fallback is the whole story. If misdetection turns
  out to be a real problem in practice, an override can be added then, informed
  by actual cases rather than speculation.
- **Backfilling existing articles.** Articles already stored have no language
  and fall back to English. `ARTICLE_RETENTION_DAYS` is 30, so the gap closes on
  its own within a month, which is not worth an operational step or a billable
  pass over the corpus.
- **Regenerating leads when a language is established later.** Does not arise,
  given there is no backfill.
- **Re-deriving the language on re-scrape.** A re-scrape does not regenerate the
  lead — the card only generates when none exists — so the language is not
  recomputed. This would only matter if an article changed language after
  publication.
- **Repairing or retrying malformed structured output.** See "Error handling".

## Decisions and their alternatives

**The model determines the language, not a detection library.** A statistical
detector (tinyld, eld) would be offline, free, and would yield a confidence
score. It was rejected in favour of reusing a call that already happens: lead
generation runs for every article at ingest, so asking for the language as an
additional structured-output field costs no extra request and no extra latency
beyond the structured-output overhead. No new dependency.

**The audio introduction is split: the title is constructed, everything after it
is generated.** The connectives around a headline ("Written by …, from …") are
the part that needs translating, so they are generated and read naturally in the
article's own language rather than coming from a hand-maintained table. The
headline itself is not: it is already known exactly, so `spokenTitle` emits it
verbatim, which both removes any chance of the model paraphrasing or translating
it and lets playback begin the moment the page opens rather than after the
model's time-to-first-token.

An earlier revision of this design generated the introduction in full and
accepted losing that head start. Splitting at the title recovers it while
keeping the benefit that motivated the change, so the briefing now opens
instantly in every language.

The generated part opens at the publication, and the prompt forbids openings
that merely announce the article as an article — "The article titled…", "Der
Artikel…" — since the listener has just heard the headline and such phrases
carry no information.

**The prompt states the language even when it is English.** The point is that
the language is deliberate rather than inferred, which means it is stated in all
cases. The observable output for an English article is unchanged; the prompt
text is not byte-identical.

## Establishing the language

`Article` gains `language String?`. Null means "never established" and resolves
to English everywhere it is read.

`generateAiLead` in `src/lib/ai/services/leadService.ts` becomes the single
point where language is determined. It swaps `generateText` for `generateObject`
with a Zod schema:

```ts
z.object({
  language: z
    .string()
    .describe(
      'The article\'s language as a two-letter ISO 639-1 code, for example "de". ' +
        'Use "und" — the standard code for "undetermined" — if the language cannot ' +
        "be established.",
    ),
  lead: z.string(),
});
```

`language` is declared **before** `lead` deliberately. Structured output is
generated field by field, so the model commits to a language and then writes the
lead in it, rather than reporting a language after the fact.

`"und"` is the registered ISO 639-2/639-3 code for "undetermined" and a valid
BCP-47 primary subtag. It exists purely to give the model a sanctioned way to
report uncertainty rather than guessing between, say, Dutch and Afrikaans on a
short article. Nothing downstream special-cases it: being three letters, it
fails the two-letter rule in step 2 below and stores null, exactly as `"German"`
and `"xx"` do. Because it is the one permitted value that is _not_ an ISO 639-1
code, the schema description names it explicitly and explains what it means —
otherwise "two letters, or this one three-letter word" reads as a contradiction
and invites the model to substitute `"un"` or `"unknown"`.

The returned value is normalised and validated by `src/lib/language.ts` before
storage. The order of the checks is load-bearing:

1. Lowercase and reduce to the primary subtag, so `"de-DE"` and `"de_DE"` become
   `"de"`.
2. Require exactly two letters (`/^[a-z]{2}$/`).
3. Require that `Intl.DisplayNames(["en"], { type: "language" }).of(code)`
   returns something other than the code itself — an unrecognised tag echoes
   itself back, which is the check.

Step 2 must precede step 3 for three verified reasons:

- `.of("")` throws a `RangeError` rather than returning a value, so the regex is
  what keeps the lookup safe.
- `.of("deu")` returns "German" rather than echoing, so ISO 639-2 codes are
  rejected by the length rule alone.
- `.of("und")` returns **"root"** — the sentinel passes the recognition check.

Reordering these would therefore admit both `"deu"` and the undetermined
sentinel itself, storing them and setting them as `utterance.lang`, where no
browser will match them against a voice. The length rule is the only thing that
catches either.

`"de-DE"` therefore survives as `"de"`; `"und"`, `"German"`, `"deu"`, `"xx"`,
`"un"`, and `""` all store null.

Storage is a single nested write, replacing the existing `articleLead.upsert`:

```ts
prisma.article.update({
  where: { id: articleId },
  data: { language, lead: { upsert: { create: { text }, update: { text } } } },
});
```

One query, so the language cannot drift out of step with the lead it was
determined alongside.

## Reading the language

`summaryService` and `audioScriptService` already load the article, so they read
`article.language` directly — no query in the codebase needs a new `include` to
find it. The audio summary page passes it to `AudioSummaryPlayer` as a prop.

`audioScriptService` does need one `include` addition — `feed: true` — because
the model now writes the introduction and needs the publication name. The author
it passes to the prompt comes from `articleAuthor(article)`, the existing helper
in `src/lib/article.ts`, so the feed-declared author continues to win over
Readability's byline and no second notion of "the author" is introduced.

## `src/lib/language.ts`

A new module, shared by server and client:

- the normalisation and validation described above;
- `languageDisplayName("de") → "German"`, via `Intl.DisplayNames`;
- the English default.

`prompts.ts` imports it to build its directive; the audio player imports it to
name a language in an alert.

## Prompts

`src/lib/ai/prompts.ts` gains a helper that renders a stored value as a
directive — `"de"` becomes "Write entirely in German.", null becomes English.
All three prompts embed it as the last instruction before the `<article>` block.
Every `language` parameter below is `string | null`, matching the column.

**`buildLeadPrompt(title, textContent)`** — signature unchanged. Rather than
receiving a language it is told to determine one: report the article's language
as an ISO 639-1 code, use `"und"` if genuinely unclear, and write the lead in
that same language.

**`buildSummaryPrompt(title, textContent, language)`** — gains the directive.
The prompt names literal English headings ("Key Facts", "Key Takeaways", "Key
Points"); these remain the _selection criteria_, with an added instruction to
render the chosen heading in the output language, so a German summary is not a
German bullet list under an English heading.

**`buildAudioScriptPrompt({ title, author, feedTitle, textContent, language })`**
— the larger rewrite. It takes a single object rather than five positional
arguments, because four of the five are strings and three of those (`title`,
`author`, `feedTitle`) are freely transposable at the call site without a type
error. The clause stating the briefing "has already been introduced" is replaced
by the introduction's requirements: open by announcing the article, reproducing
the supplied title exactly and without paraphrase or translation, then the
publication, and the author only when one is supplied. When no author is known
the field is omitted from the prompt entirely, so there is nothing to invent
from. The 150–200 word budget continues to describe the body, with the
introduction on top.

The prompt also instructs one sentence per line, a single newline between
sentences, and no blank lines — worded so it does not read as licence to produce
a bulleted list, given the same prompt forbids Markdown.

`systemPrompt` is unchanged.

## Sentence splitting

Asking the model to delimit sentences with newlines removes the need to infer
sentence boundaries from punctuation. `isSentenceEnd`, the `ABBREVIATIONS` set,
and the decimal, ordinal, and initials special-casing in
`src/lib/audio-script.ts` are all deleted. The German "z.B." problem — and the
equivalent in every other language — stops existing rather than being
generalised into per-language abbreviation tables. The delimiter also becomes
unambiguous, so a sentence can be spoken as soon as its newline arrives, without
the whitespace lookahead the current splitter needs to confirm a terminator.

`splitIntoSentences` keeps its streaming contract —
`(buffer) → { sentences, remainder }`, with the remainder fed back alongside the
next delta — because deltas still arrive mid-line. Its body becomes a newline
split.

If the model ignores the instruction and emits no newlines, the whole briefing
arrives as one utterance and runs into the roughly 15-second cut-off Chrome
applies to a single long one. This is accepted rather than defended against: a
length-based fallback was considered and rejected as not worth the complexity.

`buildOpeningLine` is replaced by `spokenTitle`, which keeps only the part that
still earns its place: terminating the headline as its own sentence. Headlines
frequently end in "?" or "!", and neither replacing that terminator nor
appending a second one reads correctly aloud. The author and publication
connectives it used to assemble are now the model's job.

## Speech playback

`useSpeechSynthesis` takes the article's language (null → English) and changes
in two ways.

**Voice matching.** From `getVoices()`, the first voice whose primary subtag
equals the article's language, tolerating both `de-DE` and `de_DE` since engines
differ. The match is held in a ref, because utterances are created at `speak()`
time as sentences stream in. `utterance.lang` is set unconditionally;
`utterance.voice` only when a match exists, leaving the engine its own fallback
otherwise.

**A second support signal.** `supported` keeps its current meaning — whether
there are any voices at all — and a new `voiceAvailable` reports whether one
matches this language. Both are recomputed in the existing `voiceschanged`
listener, since Chrome populates the voice list asynchronously.

The player can then distinguish two failures that currently look alike:

- No voices installed keeps today's "Playback unavailable" alert verbatim.
- Voices present but none matching gets a new alert naming the language ("No
  German voice is installed…"), with the transport controls left **enabled** so
  the reader can play a mispronounced briefing knowingly.
  `disabled={!supported}` stays keyed to `supported` alone.

`AudioSummaryPlayer`'s props change shape: `author` and `feedTitle` go away,
since the server action loads those itself for the generated part of the
introduction, while `language` arrives and `title` stays. The mount effect
enqueues `spokenTitle(title)` and then calls `playFrom(0)`, so audio begins
immediately and `enqueue` hands each arriving sentence straight to the engine as
it streams in.

The title is enqueued directly rather than through the transcript's `append`,
because the page heading immediately above the player already shows it — so
playback index 0 has no transcript row, and the transcript's highlight maps
display index `i` to playback index `i + 1`.

The transcript renders one block per sentence rather than inline spans joined by
spaces, so the line structure the model emits survives to the page, at
`leading-loose`.

Because the title is spoken from code, the play button showing "Pause" always
corresponds to something audible from the first moment. The only remaining case
where it does not is generation failing before any sentence arrives, which
leaves `speaking` latched true; that is recorded in the code and accepted as
cosmetic.

## Error handling

Nothing new is caught. Every new failure drains into a path that already exists.

- **Invalid language code.** Normalised and validated as described above;
  anything that fails stores null and resolves to English.
- **Malformed structured output.** Genuinely new: `generateText` cannot fail
  schema validation, `generateObject` can. It lands in the `try`/`catch` that
  `processArticle` already wraps lead generation in — logged, article kept, no
  lead, no language, English downstream. The same outcome as any of today's lead
  failures, reached a new way.
- **Lead generation failed or never ran.** Language stays null → English.
- **Scrape failed.** `textContent` is `""` today and stays so; the model works
  from the title alone and may record a language from it. A headline is usually
  enough to distinguish German from English, and the fallback is English
  regardless.
- **Pre-existing articles.** Null language, English output, purged within 30
  days.

### Retry behaviour, and why nothing is added

In `ai@7.0.44`, `generate-object.ts:398` wraps only `model.doGenerate()` in
`retry(...)`. Parsing and validation run at line 470, outside that closure.
Therefore:

- **Transport failures are retried.** `maxRetries` defaults to `2`
  (`prepare-retries.ts:35`), i.e. three attempts, with backoff starting at
  2000ms and doubling, honouring `retry-after-ms` / `retry-after` headers within
  0–60s. `shouldRetry` admits only `APICallError` or `GatewayError` with
  `isRetryable === true` — rate limits and the 5xx class. `generateText` uses
  the same wrapper today, so this is not a regression.
- **Schema failures are not retried.** Unparseable JSON, or well-formed JSON
  failing the Zod schema, throws `NoObjectGeneratedError` on the first attempt.
  The only hook is `experimental_repairText`
  (`parse-and-validate-object-result.ts:77`), which is `undefined` unless
  supplied and otherwise rethrows.

Neither a repair function nor a manual retry is added. The schema is two string
fields and is passed to the provider as
`responseFormat: { type: "json", schema }`, so providers with native structured
output enforce it server-side rather than relying on model compliance. And the
failure is survivable by construction: the reader gets a lead-less card, which
is already what any lead failure produces today. This paragraph exists so a
future reader does not assume the retry covers schema failures.

## Observability

The `logger.info` payload in all three services gains the language, so "why was
this German article read in English" is answerable from the logs without
reproducing it.

## Testing

Following the repo's existing split: the `node` project for unit and
integration, `components` for jsdom.

**New — `tests/unit/language.test.ts`.** `"de"` accepted and named "German";
`"de-DE"`, `"de_DE"`, and `"DE"` normalised to `"de"`; `"und"`, `"German"`,
`"deu"`, `"xx"`, `"un"`, and `""` rejected to null; null input resolving to
English. `"und"` and `"deu"` are the load-bearing cases — both survive the
`Intl.DisplayNames` check and are caught only by the length rule, so these tests
are what stop a future reordering of the validation from regressing silently.

**`tests/unit/prompts.test.ts`.** Summary prompt with `"de"` names German and
carries the heading-translation instruction; with null it names English. Audio
prompt includes title and feed title, includes the author when supplied, and
omits the author element entirely when none is known — the structural guard
against inventing one. Lead prompt asks for an ISO 639-1 code and offers
`"und"`.

**`tests/unit/audio-script.test.ts`.** `spokenTitle` gets: terminates a headline
that lacks punctuation, leaves an existing `?`, `!`, or `.` alone, trims.
`splitIntoSentences` gets: splits on newline, holds an unterminated remainder
across successive deltas, ignores blank lines, and — the case that discriminates
against the old punctuation splitter — keeps a sentence whole across `usw.`, a
German abbreviation the old English list did not know.

**`tests/integration/leadService.test.ts`.** The existing `vi.mock("ai", …)`
moves from `generateText` to `generateObject` returning
`{ object: { language, lead }, totalUsage }`. A valid code stores both lead and
language; an invalid code stores the lead with a null language; `"und"` stores
null; token usage is still recorded, since that path changes shape.

**`tests/helpers/speech-synthesis.ts`.** `FakeUtterance` gains `lang` and
`voice`; the fake voices gain `lang` values so matching can be exercised.

**`tests/components/hooks/use-speech-synthesis.test.tsx`.** A `de-DE` voice
present for a `de` article sets both `utterance.voice` and `utterance.lang`,
with `voiceAvailable` true; `de_DE` matches too; only `en-US` voices present
leaves `voice` unset with `supported` true and `voiceAvailable` false; no voices
at all keeps `supported` false; voices arriving later through `voiceschanged`
recompute the match.

**`tests/components/article/audio-summary-player.test.tsx`.** Updated for the
new props. No-matching-voice renders the alert naming German with transport
controls still enabled; no-voices renders today's "Playback unavailable" alert;
and a regression guard that nothing is spoken before the stream's first
sentence, since the constructed opening line is gone.

No e2e changes — the Playwright specs do not exercise generation.

## Unrelated pre-existing failure

`tests/integration/feedRepository.test.ts` fails `npx tsc --noEmit` on `main`:
its `feedItem` factory is missing the `author` field added in d6d61c7. It does
not gate `npm run build` and is not touched by this work. Noted so it is not
mistaken for fallout.
