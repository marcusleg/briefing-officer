# Audio Summary Implementation Plan

> **Status:** Implemented, shipped across `6b6e071`…`abb3c0e` and the fixes that
> followed. This is a historical planning record kept for the reasoning behind
> the design; it is not maintained and its details have since drifted from the
> code.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline Read Aloud button with a dedicated Audio Summary
page that generates a spoken-prose script and speaks it sentence by sentence
while the transcript streams in.

**Architecture:** A speaker icon on the article card and the AI Summary page
links to `/feed/[feedId]/article/[articleId]/audio-summary`. That page speaks a
locally-constructed opening line immediately, then streams a purpose-written
script from the model, splitting it into sentences and pushing each into the
`speechSynthesis` FIFO queue. Because exactly one audio surface is ever mounted,
the speech hook is rewritten as a simple queue and loses the cross-card
ownership arbitration it carries today.

**Tech Stack:** Next.js App Router (server + client components), Vercel AI SDK
(`ai`, `@ai-sdk/rsc`), Prisma, Web Speech API, shadcn/ui (Button, Slider, Label,
Alert), Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-04-audio-summary-design.md`

## Global Constraints

- **No new dependencies.** `@radix-ui/react-slider` and
  `src/components/ui/slider.tsx` are already present.
- **No Prisma migration.** The script is not persisted.
- **No author normalisation.** The `author` value is spoken verbatim. Do not
  strip a leading `"By "`, job title, or date — the real fix is a separate
  change that will prefer the RSS feed's author. Handling an empty author is
  allowed, because that is rendering, not author-determination.
- **Two Vitest projects.** `tests/unit/**/*.test.ts` runs in `node`;
  `tests/components/**/*.test.tsx` runs in `jsdom`. Put pure-function tests in
  `tests/unit/`, component and hook tests in `tests/components/`.
- **Services are not unit-tested** in this codebase (`summaryService.ts` and
  `leadService.ts` have no tests). Prompts are tested in
  `tests/unit/prompts.test.ts`. Follow that convention.
- **Commit style:** Conventional Commits **without scopes**. Every commit ends
  with both trailers:
  ```
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- **Never** use `git commit --no-verify`. The pre-commit hook runs
  `lint-staged`.
- Speech rate range is **0.5 to 2.0**, step **0.1**, default **1.0**.
  localStorage key: `briefing-officer:speech-rate`.

**Ordering note:** Task 3 deletes `ReadAloudButton` and points the speaker icon
at a route that does not exist until Task 6. The link 404s in between. This is
intentional — it is what lets Task 4 rewrite the hook without a consumer still
bound to the old API. Tests and build stay green throughout.

---

## File Structure

| File                                                               | Responsibility                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/lib/audio-script.ts`                                          | Pure script assembly: build the opening line, split a growing buffer into sentences. No React, no DOM. |
| `src/lib/ai/prompts.ts`                                            | Gains `buildAudioScriptPrompt` alongside the existing prompts.                                         |
| `src/lib/ai/services/audioScriptService.ts`                        | Server action streaming the script body from the model. Mirrors `summaryService.ts`.                   |
| `src/hooks/use-speech-synthesis.ts`                                | Rewritten: owns the sentence queue, playback state, active index, and rate.                            |
| `src/components/article/audio-summary-button.tsx`                  | Icon link to the audio page. Mirrors `AiSummaryButton`.                                                |
| `src/components/article/audio-summary-player.tsx`                  | Client: streams the script, owns transcript display state, renders transport + rate slider.            |
| `src/components/article/audio-summary-article-actions.tsx`         | Client wrapper giving the audio page its actions row with `router.back()` on dismiss.                  |
| `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx` | Server: auth, article load, header, unavailable states.                                                |
| `src/components/article/article-card-actions.tsx`                  | `hideSummarizeButton` → `currentPage`; drops `leadText`.                                               |

---

### Task 1: Audio script helpers

Pure functions with no React or DOM. Everything downstream depends on these, so
they come first.

**Files:**

- Create: `src/lib/audio-script.ts`
- Test: `tests/unit/audio-script.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `buildOpeningLine(title: string, author: string | null | undefined, feedTitle: string): string`
  - `splitIntoSentences(buffer: string): { sentences: string[]; remainder: string }`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/audio-script.test.ts`:

```ts
import { buildOpeningLine, splitIntoSentences } from "@/lib/audio-script";
import { describe, expect, it } from "vitest";

describe("buildOpeningLine", () => {
  it("names the article, its author, and its feed", () => {
    expect(
      buildOpeningLine("Kernel 7.2 removes strncpy", "Jane Doe", "Hacker News"),
    ).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("drops the attribution when the scraper found no byline", () => {
    // scraper.ts stores "" when Readability finds no byline, which is common.
    expect(
      buildOpeningLine("Kernel 7.2 removes strncpy", "", "Hacker News"),
    ).toBe("Kernel 7.2 removes strncpy. From Hacker News.");
  });

  it("drops the attribution when the author is null or undefined", () => {
    expect(buildOpeningLine("A title", null, "Hacker News")).toBe(
      "A title. From Hacker News.",
    );
    expect(buildOpeningLine("A title", undefined, "Hacker News")).toBe(
      "A title. From Hacker News.",
    );
  });

  it("keeps a title's own terminal punctuation instead of adding a period", () => {
    // Headlines ending in "?" or "!" are common; running them into a comma
    // would read as an audible glitch.
    expect(buildOpeningLine("Is Rust dead?", "Jane Doe", "Hacker News")).toBe(
      "Is Rust dead? Written by Jane Doe, from Hacker News.",
    );
    expect(buildOpeningLine("Ship it!", "", "Hacker News")).toBe(
      "Ship it! From Hacker News.",
    );
  });

  it("speaks the author verbatim without tidying the byline", () => {
    // Normalising bylines here would create a second place that knows how to
    // clean them up, making the real fix harder. See the spec's non-goals.
    expect(buildOpeningLine("A title", "By Jane Doe", "Hacker News")).toBe(
      "A title. Written by By Jane Doe, from Hacker News.",
    );
  });
});

describe("splitIntoSentences", () => {
  it("returns complete sentences and keeps the unterminated tail", () => {
    expect(
      splitIntoSentences("Linux 7.2 drops strncpy. It landed Fri"),
    ).toEqual({
      sentences: ["Linux 7.2 drops strncpy."],
      remainder: "It landed Fri",
    });
  });

  it("splits on question and exclamation marks", () => {
    expect(splitIntoSentences("Is Rust dead? No! Not yet")).toEqual({
      sentences: ["Is Rust dead?", "No!"],
      remainder: "Not yet",
    });
  });

  it("does not split inside a decimal number", () => {
    expect(
      splitIntoSentences("Revenue rose 3.5 percent last year. And more"),
    ).toEqual({
      sentences: ["Revenue rose 3.5 percent last year."],
      remainder: "And more",
    });
  });

  it("does not split after a common abbreviation", () => {
    expect(splitIntoSentences("Dr. Smith arrived. Then left")).toEqual({
      sentences: ["Dr. Smith arrived."],
      remainder: "Then left",
    });
  });

  it("does not split inside an acronym with periods", () => {
    expect(splitIntoSentences("The U.S. government agreed. Later on")).toEqual({
      sentences: ["The U.S. government agreed."],
      remainder: "Later on",
    });
  });

  it("treats an ellipsis as a pause, not a sentence end", () => {
    expect(splitIntoSentences("Well... anyway. Next up")).toEqual({
      sentences: ["Well... anyway."],
      remainder: "Next up",
    });
  });

  it("holds back a terminator that no whitespace has confirmed yet", () => {
    // Mid-stream, "3." may still become "3.5", so a terminator only counts
    // once the following character has arrived.
    expect(splitIntoSentences("It cost 3.")).toEqual({
      sentences: [],
      remainder: "It cost 3.",
    });
  });

  it("returns nothing for empty and whitespace-only input", () => {
    expect(splitIntoSentences("")).toEqual({ sentences: [], remainder: "" });
    expect(splitIntoSentences("   ")).toEqual({ sentences: [], remainder: "" });
  });

  it("finds several sentences in one buffer", () => {
    expect(splitIntoSentences("One. Two. Three")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/unit/audio-script.test.ts`

Expected: FAIL — `Failed to resolve import "@/lib/audio-script"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/audio-script.ts`:

```ts
/**
 * Words that end in a period without ending a sentence. Lowercased, without
 * the trailing period.
 */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "eg",
  "ie",
  "approx",
  "inc",
  "ltd",
  "co",
  "no",
  "fig",
]);

const isSentenceEnd = (buffer: string, index: number): boolean => {
  const character = buffer[index];
  if (character !== "." && character !== "!" && character !== "?") {
    return false;
  }

  // A terminator only counts once the following character confirms it. Without
  // this, a buffer ending in "3." would split a decimal that has not finished
  // arriving. The caller flushes whatever remains when the stream closes.
  if (!/\s/.test(buffer[index + 1] ?? "")) {
    return false;
  }

  if (character !== ".") {
    return true;
  }

  // An ellipsis is a pause inside a sentence, not the end of one.
  if (buffer[index - 1] === ".") {
    return false;
  }

  const precedingWord = /([A-Za-z]+)$/.exec(buffer.slice(0, index))?.[1];
  if (!precedingWord) {
    return true;
  }

  // A single letter before a period is an initial or part of an acronym:
  // "U.S.", "J. R. R. Tolkien".
  if (precedingWord.length === 1) {
    return false;
  }

  return !ABBREVIATIONS.has(precedingWord.toLowerCase());
};

/**
 * Splits a buffer into complete sentences plus whatever is left over. Safe to
 * call repeatedly against a growing stream: feed the remainder back in with the
 * next delta appended.
 */
export const splitIntoSentences = (
  buffer: string,
): { sentences: string[]; remainder: string } => {
  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < buffer.length; index++) {
    if (!isSentenceEnd(buffer, index)) {
      continue;
    }

    const sentence = buffer.slice(start, index + 1).trim();
    if (sentence) {
      sentences.push(sentence);
    }
    start = index + 1;
  }

  return { sentences, remainder: buffer.slice(start).trim() };
};

/**
 * Builds the spoken introduction. This is constructed rather than generated:
 * the title, author, and feed are already known, so involving the model would
 * only risk it paraphrasing the title or inventing an author.
 *
 * The author is spoken verbatim. Readability's byline is unreliable, but
 * cleaning it up here would create a second place that knows how to tidy
 * bylines and make the real fix harder — see the design's non-goals.
 */
export const buildOpeningLine = (
  title: string,
  author: string | null | undefined,
  feedTitle: string,
): string => {
  const trimmedTitle = title.trim();

  // The title terminates as its own sentence. Headlines frequently end in "?"
  // or "!", and running those into a comma reads as an audible glitch.
  const introduction = /[.!?]$/.test(trimmedTitle)
    ? trimmedTitle
    : `${trimmedTitle}.`;

  // The scraper stores "" when Readability finds no byline. Without this
  // branch the line would read "Written by , from Hacker News".
  const trimmedAuthor = author?.trim();
  if (!trimmedAuthor) {
    return `${introduction} From ${feedTitle}.`;
  }

  return `${introduction} Written by ${trimmedAuthor}, from ${feedTitle}.`;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project node tests/unit/audio-script.test.ts`

Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio-script.ts tests/unit/audio-script.test.ts
git commit -m "$(cat <<'EOF'
feat: add audio script assembly helpers

Adds the two pure functions the audio summary needs: one builds the spoken
introduction from the title, author, and feed, and one splits a growing stream
buffer into complete sentences.

The introduction is constructed rather than generated. The values are already
known, so asking the model for them would only risk it paraphrasing the title
or inventing an author. The title terminates as its own sentence because feed
headlines frequently end in a question mark, which would collide with a comma.

The splitter holds back a terminator until whitespace confirms it, so a decimal
still arriving mid-stream is not mistaken for a sentence end. It also declines
to split on abbreviations, single-letter acronym components, and ellipses.

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Audio script prompt and streaming service

The prompt is tested; the service is not, matching how `summaryService.ts` and
`leadService.ts` are treated in this codebase.

**Files:**

- Modify: `src/lib/ai/prompts.ts` (append after `buildLeadPrompt`)
- Create: `src/lib/ai/services/audioScriptService.ts`
- Test: `tests/unit/prompts.test.ts` (append)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `buildAudioScriptPrompt(title: string, textContent: string): string`
  - `streamAudioScript(articleId: number): Promise<{ output: StreamableValue<string> }>`
    — a server action; the client reads `output` with `readStreamableValue`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/prompts.test.ts`, and add `buildAudioScriptPrompt` to the
existing import on line 1:

```ts
describe("buildAudioScriptPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
  });

  it("asks for spoken prose of about one minute", () => {
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("150 to 200 words");
  });

  it("forbids Markdown, since the output is spoken rather than rendered", () => {
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("plain text only");
  });

  it("tells the model the article has already been introduced", () => {
    // The opening line is constructed in code, so the body must not repeat it.
    const prompt = buildAudioScriptPrompt("My Title", "Body text here");
    expect(prompt).toContain("already been introduced");
  });
});
```

The import on line 1 becomes:

```ts
import {
  buildAudioScriptPrompt,
  buildLeadPrompt,
  buildSummaryPrompt,
} from "@/lib/ai/prompts";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project node tests/unit/prompts.test.ts`

Expected: FAIL — `buildAudioScriptPrompt is not a function`.

- [ ] **Step 3: Add the prompt**

Append to `src/lib/ai/prompts.ts`:

```ts
export const buildAudioScriptPrompt = (title: string, textContent: string) =>
  `Write the body of a spoken audio briefing that a text-to-speech voice will read aloud. The briefing has already been introduced with the article's title, author, and publication, so do not restate any of them and do not open with a greeting.

Write 150 to 200 words of continuous prose — roughly one minute of speech. Use short declarative sentences. Connect them with explicit transitions so the briefing flows when heard rather than read. Write numbers, symbols, and units the way they are spoken, for example "forty percent" rather than "40%". Avoid parenthetical asides, which cannot be heard.

Output plain text only. Do not use Markdown, headings, bullet lists, bold, or italics.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project node tests/unit/prompts.test.ts`

Expected: PASS — 6 tests (2 existing, 4 new).

- [ ] **Step 5: Add the streaming service**

Create `src/lib/ai/services/audioScriptService.ts`. This mirrors
`summaryService.ts` exactly, including the detached generation block:

```ts
"use server";

import { buildAudioScriptPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { createStreamableValue } from "@ai-sdk/rsc";
import { streamText } from "ai";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

export const streamAudioScript = async (articleId: number) => {
  const userId = await getUserId();

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId, userId },
    include: { scrape: true },
  });

  const stream = createStreamableValue("");

  void (async () => {
    const { textStream, totalUsage } = streamText({
      model,
      system: systemPrompt,
      prompt: buildAudioScriptPrompt(
        article.title,
        article.scrape?.textContent ?? "",
      ),
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();

    const tokenUsage = await totalUsage;

    logger.info(
      {
        articleId,
        feedId: article.feedId,
        model: model.modelId,
        tokenUsage,
      },
      "Audio script generated.",
    );

    await trackTokenUsage(
      userId,
      model.modelId,
      tokenUsage.inputTokens ?? 0,
      tokenUsage.outputTokens ?? 0,
    );
  })();

  return { output: stream.value };
};
```

- [ ] **Step 6: Verify the project still type-checks and lints**

Run: `npm run lint`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/services/audioScriptService.ts tests/unit/prompts.test.ts
git commit -m "$(cat <<'EOF'
feat: generate a spoken script for audio summaries

The existing summary prompt is deliberately visual — a heading, terse bullets,
a bolded entity in each — which reads badly aloud. This adds a prompt for
continuous prose written for the ear: short declarative sentences, explicit
transitions, numbers spelled as spoken, and no Markdown.

The prompt writes only the body. The introduction naming the title, author, and
feed is constructed in code, so the model is told the briefing has already been
introduced and must not restate it.

The service mirrors the existing summary service, including its detached
generation block; the script is not persisted.

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Swap the speaker icon for a link

This deletes `ReadAloudButton`, which is the only consumer of the current speech
hook API. Task 4 can then rewrite the hook freely.

The link points at a route that does not exist until Task 6, so it 404s in the
meantime. That is expected.

**Files:**

- Create: `src/components/article/audio-summary-button.tsx`
- Modify: `src/components/article/article-card-actions.tsx`
- Modify: `src/components/article/article-card.tsx`
- Modify: `src/components/article/ai-summary-article-actions.tsx`
- Delete: `src/components/article/read-aloud-button.tsx`
- Delete: `tests/components/article/read-aloud-button.test.tsx`
- Test: `tests/components/article/audio-summary-button.test.tsx` (create),
  `tests/components/article/article-card-actions.test.tsx` (rewrite)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `AudioSummaryButton` — default export, props
    `{ feedId: number; articleId: number; variant?: "secondary" | "ghost" }`,
    renders an anchor labelled `"Audio summary"` pointing at
    `/feed/{feedId}/article/{articleId}/audio-summary`.
  - `ArticleCardActionsProps` gains
    `currentPage?: "ai-summary" | "audio-summary"` and loses
    `hideSummarizeButton` and `leadText`.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/article/audio-summary-button.test.tsx`:

```tsx
import AudioSummaryButton from "@/components/article/audio-summary-button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AudioSummaryButton", () => {
  it("links to the audio summary page for the article", () => {
    render(<AudioSummaryButton feedId={7} articleId={42} />);

    const link = screen.getByRole("link", { name: /audio summary/i });
    expect(link).toHaveAttribute("href", "/feed/7/article/42/audio-summary");
  });
});
```

Replace the whole of `tests/components/article/article-card-actions.test.tsx`:

```tsx
import ArticleCardActions from "@/components/article/article-card-actions";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsRead: vi.fn().mockResolvedValue(undefined),
  markArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  markArticleAsStarred: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsStarred: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const article = {
  id: 1,
  feedId: 1,
  title: "Kernel 7.2 removes strncpy",
  link: "https://example.com/article",
  commentsLink: null,
  readAt: null,
  readLater: false,
  starred: false,
} as any;

describe("ArticleCardActions", () => {
  it("links to the audio summary page in both layouts", () => {
    render(<ArticleCardActions article={article} />);

    // Both the mobile (md:hidden) and desktop (hidden md:flex) layouts render
    // into the DOM simultaneously; CSS, not JS, decides which is visible.
    const links = screen.getAllByRole("link", { name: /audio summary/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/feed/1/article/1/audio-summary");
  });

  it("hides the summarize entry on the AI summary page", () => {
    render(<ArticleCardActions article={article} currentPage="ai-summary" />);

    expect(
      screen.queryByRole("link", { name: /summarize/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /audio summary/i }),
    ).toHaveLength(2);
  });

  it("hides the audio entry on the audio summary page", () => {
    render(
      <ArticleCardActions article={article} currentPage="audio-summary" />,
    );

    expect(
      screen.queryByRole("link", { name: /audio summary/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /summarize/i })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
`npx vitest run --project components tests/components/article/audio-summary-button.test.tsx tests/components/article/article-card-actions.test.tsx`

Expected: FAIL —
`Failed to resolve import "@/components/article/audio-summary-button"`.

- [ ] **Step 3: Create the button**

Create `src/components/article/audio-summary-button.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Volume2Icon } from "lucide-react";
import Link from "next/link";

interface AudioSummaryButtonProps {
  feedId: number;
  articleId: number;
  variant?: "secondary" | "ghost";
}

const AudioSummaryButton = ({
  feedId,
  articleId,
  variant = "secondary",
}: AudioSummaryButtonProps) => (
  <Button asChild variant={variant} size="icon" aria-label="Audio summary">
    <Link href={`/feed/${feedId}/article/${articleId}/audio-summary`}>
      <Volume2Icon className="size-4" />
    </Link>
  </Button>
);

export default AudioSummaryButton;
```

- [ ] **Step 4: Rewrite the actions row**

Replace `src/components/article/article-card-actions.tsx` in full:

```tsx
"use client";

import AiSummaryButton from "@/components/article/ai-summary-button";
import AudioSummaryButton from "@/components/article/audio-summary-button";
import CommentsButton from "@/components/article/comments-button";
import DismissButton from "@/components/article/dismiss-button";
import ToggleReadLaterButton from "@/components/article/toggle-read-later-button";
import ToggleStarredButton from "@/components/article/toggle-starred-button";
import VisitButton from "@/components/article/visit-button";
import { Prisma } from "@/generated/prisma/client";
import { ClockIcon } from "lucide-react";

interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  /** The page rendering this row, so it can suppress its own entry. */
  currentPage?: "ai-summary" | "audio-summary";
  onAfterDismiss?: () => void;
  readingTime?: { text: string; minutes: number; time: number; words: number };
}

const ReadingTimeLabel = ({
  readingTime,
}: {
  readingTime: NonNullable<ArticleCardActionsProps["readingTime"]>;
}) => (
  <span className="text-muted-foreground flex items-center gap-1 text-xs">
    <ClockIcon className="size-3" />
    {readingTime.text}
  </span>
);

const ArticleCardActions = (props: ArticleCardActionsProps) => (
  <>
    {/* Mobile: row 1 — reading time left, icon buttons right */}
    <div className="flex w-full items-center gap-2 md:hidden">
      {props.readingTime && (
        <ReadingTimeLabel readingTime={props.readingTime} />
      )}
      <div className="grow" />
      <ToggleReadLaterButton article={props.article} variant="ghost" />
      <ToggleStarredButton article={props.article} variant="ghost" />
      <CommentsButton article={props.article} variant="ghost" />
      {props.currentPage !== "audio-summary" && (
        <AudioSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          variant="ghost"
        />
      )}
    </div>

    {/* Mobile: row 2 — full-width labeled buttons */}
    <div className="flex w-full gap-2 md:hidden">
      <DismissButton
        article={props.article}
        className="flex-1 justify-center text-sm"
        onAfterDismiss={props.onAfterDismiss}
      />
      {props.currentPage !== "ai-summary" && (
        <AiSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
          size="sm"
          className="flex-1 justify-center text-sm"
        />
      )}
      <VisitButton
        article={props.article}
        size="sm"
        className="flex-1 justify-center text-sm"
      />
    </div>

    {/* Desktop: single row */}
    <div className="hidden md:flex md:w-full md:items-center md:gap-2">
      {props.readingTime && (
        <ReadingTimeLabel readingTime={props.readingTime} />
      )}
      <div className="grow" />
      <ToggleReadLaterButton article={props.article} />
      <ToggleStarredButton article={props.article} />
      <CommentsButton article={props.article} />
      {props.currentPage !== "audio-summary" && (
        <AudioSummaryButton
          feedId={props.article.feedId}
          articleId={props.article.id}
        />
      )}
      <DismissButton
        article={props.article}
        className="cursor-pointer justify-start text-sm"
        onAfterDismiss={props.onAfterDismiss}
      />
      {props.currentPage !== "ai-summary" && (
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

- [ ] **Step 5: Update the two call sites and add the hotkey**

In `src/components/article/ai-summary-article-actions.tsx`, replace
`hideSummarizeButton` with `currentPage="ai-summary"`:

```tsx
<ArticleCardActions
  article={article}
  currentPage="ai-summary"
  readingTime={articleReadingTime}
  onAfterDismiss={() => router.back()}
/>
```

In `src/components/article/article-card.tsx`, drop the `leadText` prop from the
`ArticleCardActions` call:

```tsx
<ArticleCardActions article={props.article} readingTime={articleReadingTime} />
```

And add the `a` hotkey immediately after the existing `s` hotkey block (`s`,
`v`, `m`, `p`, and `n` are taken; `a` is free):

```tsx
useHotkeys(
  "a",
  createHotkeyHandler(() => {
    router.push(
      `/feed/${props.article.feedId}/article/${props.article.id}/audio-summary`,
    );
  }),
);
```

- [ ] **Step 6: Delete the old button and its test**

```bash
git rm src/components/article/read-aloud-button.tsx tests/components/article/read-aloud-button.test.tsx
```

- [ ] **Step 7: Run the component suite**

Run: `npx vitest run --project components`

Expected: PASS. `use-speech-synthesis.test.tsx` still passes — the hook itself
is untouched until Task 4.

- [ ] **Step 8: Verify lint and build**

Run: `npm run lint && npm run build`

Expected: both succeed. `aiLead` is still used for the card's description text,
so no unused-variable error.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: open a dedicated page from the article card's speaker icon

The speaker icon now navigates to an audio summary page instead of speaking the
lead inline. As a link it is always safe to render, so the button loses the
speech hook, the tooltip, and the support check that previously made it vanish
on machines without a speech engine.

That also removes the lead-text guard duplicated across all three layout blocks
and the lead threading from the card. The lead itself stays as the card's
description.

The row previously hid one entry with a boolean; it now takes the current page
and suppresses its own entry, which extends to the audio page without a second
flag. Pressing "a" on the selected card opens the page, alongside "s".

The route itself arrives in a later commit on this branch.

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Rewrite the speech hook as a queue

Nothing consumes the hook after Task 3, so this is a free-hand rewrite.

The design note that matters: `speechSynthesis.cancel()` makes the engine fire
`onend` for every pending utterance. A generation counter distinguishes "my
queue finished naturally" from "my queue was thrown away", which is what stops a
discarded queue from clobbering the state of the queue that replaced it.

**Files:**

- Modify: `src/hooks/use-speech-synthesis.ts` (full rewrite)
- Modify: `tests/helpers/speech-synthesis.ts`
- Test: `tests/components/hooks/use-speech-synthesis.test.tsx` (full rewrite)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces `useSpeechSynthesis(): SpeechSynthesisControls`:

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

Semantics the player in Task 5 relies on:

- `enqueue` appends to the hook's retained sentence list. If playback is
  running, the sentence is handed straight to the engine, which appends it to
  its own FIFO queue — playback does not restart.
- `playFrom(index)` discards the engine queue and speaks from `index` to the end
  of the retained list.
- `speaking` stays `true` while paused. The player shows Pause when
  `speaking && !paused`.
- `setRate` stores the value, and re-speaks from `activeIndex` when something is
  playing, because `rate` is read at `speak()` time and cannot affect
  already-queued utterances.

- [ ] **Step 1: Extend the fake speech engine**

Replace `tests/helpers/speech-synthesis.ts` in full:

```ts
import { vi } from "vitest";

/**
 * jsdom implements neither `speechSynthesis` nor `SpeechSynthesisUtterance`,
 * so tests that exercise the Web Speech API install these fakes instead.
 */
export class FakeUtterance {
  text: string;
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

/**
 * Installs a fake speech engine on the global object and returns it so tests
 * can assert against its calls. Pass an empty array to simulate a browser with
 * no voices installed. Call `vi.unstubAllGlobals()` afterwards.
 *
 * `spoken()` returns the utterances handed to `speak()` in order, which is the
 * queue the real engine would play back to back.
 */
export const installSpeechEngine = (
  voices: unknown[] = [{ name: "Test Voice" }],
) => {
  const speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal("speechSynthesis", speechSynthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

  return {
    ...speechSynthesis,
    spoken: () =>
      speechSynthesis.speak.mock.calls.map(
        (call) => call[0] as unknown as FakeUtterance,
      ),
  };
};
```

- [ ] **Step 2: Write the failing tests**

Replace `tests/components/hooks/use-speech-synthesis.test.tsx` in full:

```tsx
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

afterEach(() => vi.unstubAllGlobals());

describe("useSpeechSynthesis", () => {
  it("is unsupported when the browser has no speech engine", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.supported).toBe(false);
  });

  it("becomes supported once voices have loaded", () => {
    const voices: unknown[] = [];
    const engine = installSpeechEngine(voices);

    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.supported).toBe(false);

    // Chrome fires voiceschanged once the engine has enumerated its voices.
    voices.push({ name: "Test Voice" });
    const [event, listener] = engine.addEventListener.mock.calls[0];
    expect(event).toBe("voiceschanged");
    act(() => listener());

    expect(result.current.supported).toBe(true);
  });

  it("does not speak sentences enqueued before playback starts", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.enqueue("One."));

    expect(engine.speak).not.toHaveBeenCalled();
  });

  it("speaks the retained sentences in order once playback starts", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });

    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "One.",
      "Two.",
    ]);
    expect(result.current.speaking).toBe(true);
  });

  it("appends to the live queue without restarting playback", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    act(() => result.current.enqueue("Two."));

    // The engine queues utterances FIFO, so appending is enough — a restart
    // would replay "One." from the beginning.
    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "One.",
      "Two.",
    ]);
    expect(engine.cancel).toHaveBeenCalledOnce();
  });

  it("tracks which sentence is speaking", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });
    expect(result.current.activeIndex).toBeUndefined();

    act(() => engine.spoken()[0].onstart!());
    expect(result.current.activeIndex).toBe(0);

    act(() => engine.spoken()[1].onstart!());
    expect(result.current.activeIndex).toBe(1);
  });

  it("stops speaking once the final sentence ends", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });

    act(() => engine.spoken()[0].onend!());
    expect(result.current.speaking).toBe(true);

    act(() => engine.spoken()[1].onend!());
    expect(result.current.speaking).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();
  });

  it("ignores end events from a queue that was thrown away", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    const discarded = engine.spoken()[0];

    act(() => result.current.playFrom(0));
    // cancel() makes the real engine fire onend for every pending utterance.
    act(() => discarded.onend!());

    expect(result.current.speaking).toBe(true);
  });

  it("pauses and resumes without ending playback", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    act(() => result.current.pause());
    expect(engine.pause).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(true);
    expect(result.current.speaking).toBe(true);

    act(() => result.current.resume());
    expect(engine.resume).toHaveBeenCalledOnce();
    expect(result.current.paused).toBe(false);
  });

  it("cancels playback and clears the active sentence", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    act(() => result.current.cancel());

    expect(result.current.speaking).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();
    expect(engine.cancel).toHaveBeenCalledTimes(2);
  });

  it("applies the rate to newly spoken utterances", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.setRate(1.5));
    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    expect(result.current.rate).toBe(1.5);
    expect(engine.spoken()[0].rate).toBe(1.5);
  });

  it("re-speaks from the active sentence when the rate changes mid-playback", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.enqueue("Two.");
      result.current.playFrom(0);
    });
    act(() => engine.spoken()[1].onstart!());

    act(() => result.current.setRate(1.5));

    // rate is read at speak() time, so queued utterances keep the old value.
    // Only the sentence being spoken and those after it are re-queued.
    const respoken = engine.spoken().slice(2);
    expect(respoken.map((utterance) => utterance.text)).toEqual(["Two."]);
    expect(respoken[0].rate).toBe(1.5);
  });

  it("only stores the rate when nothing is playing", () => {
    const engine = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.enqueue("One."));
    act(() => result.current.setRate(1.5));

    expect(engine.speak).not.toHaveBeenCalled();
    expect(result.current.rate).toBe(1.5);
  });

  it("cancels playback when the component unmounts", () => {
    const engine = installSpeechEngine();
    const { result, unmount } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    unmount();

    // Only one audio surface is ever mounted, so this needs no ownership check.
    expect(engine.cancel).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
`npx vitest run --project components tests/components/hooks/use-speech-synthesis.test.tsx`

Expected: FAIL — `result.current.enqueue is not a function`.

- [ ] **Step 4: Rewrite the hook**

Replace `src/hooks/use-speech-synthesis.ts` in full:

```ts
import * as React from "react";

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

/**
 * Drives the Web Speech API as a queue of sentences.
 *
 * Utterances are handed to `speechSynthesis` one sentence at a time and the
 * engine plays them back to back, so a script can start speaking while the rest
 * of it is still being generated. Short utterances also stay well under the
 * roughly 15 second cut-off Chrome applies to a single long one.
 *
 * Only one audio surface is mounted at a time, so this needs none of the
 * cross-component arbitration a per-card version would.
 */
export function useSpeechSynthesis(): SpeechSynthesisControls {
  const [supported, setSupported] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined,
  );
  const [rate, setRateState] = React.useState(1);

  // Every sentence handed to enqueue(), retained so playFrom() can re-speak
  // from an arbitrary point.
  const sentences = React.useRef<string[]>([]);
  const playing = React.useRef(false);
  const rateValue = React.useRef(1);
  const activeIndexValue = React.useRef<number | undefined>(undefined);

  // Incremented whenever the engine queue is discarded. cancel() makes the
  // engine fire onend for every pending utterance, so handlers compare against
  // this to tell "my queue finished" from "my queue was thrown away".
  const generation = React.useRef(0);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    // getVoices() is populated asynchronously in Chrome, so an empty list only
    // means "no voices" after voiceschanged has fired. Linux without
    // speech-dispatcher installed never reports any.
    const syncSupport = () =>
      setSupported(window.speechSynthesis.getVoices().length > 0);

    syncSupport();
    window.speechSynthesis.addEventListener("voiceschanged", syncSupport);

    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", syncSupport);
  }, []);

  const speakSentence = React.useCallback(
    (index: number, forGeneration: number) => {
      const utterance = new SpeechSynthesisUtterance(sentences.current[index]);
      utterance.rate = rateValue.current;

      utterance.onstart = () => {
        if (generation.current !== forGeneration) return;
        activeIndexValue.current = index;
        setActiveIndex(index);
      };

      const handleDone = () => {
        if (generation.current !== forGeneration) return;

        // More sentences may have arrived while this one was speaking, and the
        // engine is already playing them. Only the true tail ends playback.
        if (index !== sentences.current.length - 1) return;

        playing.current = false;
        activeIndexValue.current = undefined;
        setSpeaking(false);
        setPaused(false);
        setActiveIndex(undefined);
      };

      utterance.onend = handleDone;
      utterance.onerror = handleDone;

      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  const playFrom = React.useCallback(
    (index: number) => {
      generation.current += 1;
      const forGeneration = generation.current;
      window.speechSynthesis.cancel();

      playing.current = true;
      activeIndexValue.current = undefined;
      setSpeaking(true);
      setPaused(false);
      setActiveIndex(undefined);

      for (
        let position = index;
        position < sentences.current.length;
        position++
      ) {
        speakSentence(position, forGeneration);
      }
    },
    [speakSentence],
  );

  const enqueue = React.useCallback(
    (sentence: string) => {
      const index = sentences.current.length;
      sentences.current = [...sentences.current, sentence];

      // While playing, hand the sentence straight to the engine — it appends to
      // its own FIFO queue, so playback continues rather than restarting.
      if (playing.current) {
        speakSentence(index, generation.current);
      }
    },
    [speakSentence],
  );

  const cancel = React.useCallback(() => {
    generation.current += 1;
    playing.current = false;
    activeIndexValue.current = undefined;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
    setActiveIndex(undefined);
  }, []);

  const pause = React.useCallback(() => {
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = React.useCallback(() => {
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const setRate = React.useCallback(
    (next: number) => {
      rateValue.current = next;
      setRateState(next);

      // rate is read at speak() time, so utterances already queued keep the old
      // value. Re-speak from the current sentence to apply it immediately.
      if (playing.current) {
        playFrom(activeIndexValue.current ?? 0);
      }
    },
    [playFrom],
  );

  // Stop playback when the page goes away. Only one audio surface is ever
  // mounted, so this cancels unconditionally.
  React.useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );

  return {
    activeIndex,
    cancel,
    enqueue,
    pause,
    paused,
    playFrom,
    rate,
    resume,
    setRate,
    speaking,
    supported,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
`npx vitest run --project components tests/components/hooks/use-speech-synthesis.test.tsx`

Expected: PASS — 15 tests.

- [ ] **Step 6: Run the full suite and lint**

Run: `npm run test && npm run lint`

Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: drive speech synthesis as a queue of sentences

Utterances are now handed to the engine one sentence at a time and played back
to back, so a script can start speaking while the rest of it is still being
generated. Short utterances also stay well under the roughly 15 second cut-off
Chrome applies to a single long one, so the pause/resume keepalive is gone —
it would otherwise have fought the new pause control.

With playback confined to a single page, the hook no longer arbitrates between
components: the utterance-ownership ref and the guarded unmount cancel are
replaced by an unconditional cancel.

Cancelling makes the engine fire an end event for every pending utterance, so a
generation counter distinguishes a queue that finished from one that was thrown
away. Without it, a discarded queue would clear the state of the queue that
replaced it.

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The audio summary player

**Files:**

- Create: `src/components/article/audio-summary-player.tsx`
- Test: `tests/components/article/audio-summary-player.test.tsx`

**Interfaces:**

- Consumes: `buildOpeningLine`, `splitIntoSentences` (Task 1);
  `streamAudioScript` (Task 2); `useSpeechSynthesis` (Task 4).
- Produces: `AudioSummaryPlayer` — default export, props
  `{ articleId: number; title: string; author: string | null | undefined; feedTitle: string }`.

Design notes for the implementer:

- The player owns the sentence list **for display**; the hook keeps its own copy
  **for playback**. They are appended in lockstep. This is deliberate: the
  hook's copy is a ref, so it is not reactive and cannot drive rendering.
- The opening line is enqueued and played before the stream is even requested,
  so audio starts without waiting on the model.
- `initialized.current` guards against React Strict Mode double-invocation,
  mirroring `AiSummaryStream`.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/article/audio-summary-player.test.tsx`:

```tsx
import AudioSummaryPlayer from "@/components/article/audio-summary-player";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

vi.mock("@/lib/ai/services/audioScriptService", () => ({
  streamAudioScript: vi.fn().mockResolvedValue({ output: "streamable" }),
}));

vi.mock("@ai-sdk/rsc", () => ({
  readStreamableValue: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield "It landed after 362 patches. ";
      yield "Maintainers had warned for years.";
    },
  })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const props = {
  articleId: 42,
  title: "Kernel 7.2 removes strncpy",
  author: "Jane Doe",
  feedTitle: "Hacker News",
};

describe("AudioSummaryPlayer", () => {
  it("speaks the constructed opening before any generated text arrives", () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    expect(engine.spoken()[0].text).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("speaks each generated sentence as it streams in", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() =>
      expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
        "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
        "It landed after 362 patches.",
        "Maintainers had warned for years.",
      ]),
    );
  });

  it("renders the transcript as it arrives", async () => {
    installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    expect(
      await screen.findByText(/It landed after 362 patches\./),
    ).toBeInTheDocument();
  });

  it("highlights the sentence the engine reports as started", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(3));

    engine.spoken()[1].onstart!();

    await waitFor(() =>
      expect(screen.getByText(/It landed after 362 patches\./)).toHaveAttribute(
        "data-active",
        "true",
      ),
    );
  });

  it("pauses and resumes playback", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(engine.pause).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(engine.resume).toHaveBeenCalledOnce();
  });

  it("restarts from the first sentence", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(3));

    await userEvent.click(screen.getByRole("button", { name: /restart/i }));

    const respoken = engine.spoken().slice(3);
    expect(respoken[0].text).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("restores a saved rate and applies it to speech", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "1.5");
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() => expect(screen.getByText("1.5×")).toBeInTheDocument());
    await waitFor(() => expect(engine.spoken().at(-1)!.rate).toBe(1.5));
  });

  it("ignores a stored rate outside the supported range", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "9");
    installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() => expect(screen.getByText("1.0×")).toBeInTheDocument());
  });

  it("tells the reader when the browser has no speech voices", async () => {
    installSpeechEngine([]);

    render(<AudioSummaryPlayer {...props} />);

    expect(await screen.findByText(/no speech voices/i)).toBeInTheDocument();
    // The transcript still streams, so reading remains possible.
    expect(
      await screen.findByText(/It landed after 362 patches\./),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
`npx vitest run --project components tests/components/article/audio-summary-player.test.tsx`

Expected: FAIL —
`Failed to resolve import "@/components/article/audio-summary-player"`.

- [ ] **Step 3: Write the player**

Create `src/components/article/audio-summary-player.tsx`:

```tsx
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { streamAudioScript } from "@/lib/ai/services/audioScriptService";
import { buildOpeningLine, splitIntoSentences } from "@/lib/audio-script";
import { readStreamableValue } from "@ai-sdk/rsc";
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

const RATE_STORAGE_KEY = "briefing-officer:speech-rate";
const MIN_RATE = 0.5;
const MAX_RATE = 2;

interface AudioSummaryPlayerProps {
  articleId: number;
  author: string | null | undefined;
  feedTitle: string;
  title: string;
}

const AudioSummaryPlayer = (props: AudioSummaryPlayerProps) => {
  const speech = useSpeechSynthesis();
  // The hook keeps its own copy of the sentences for playback, but that copy is
  // a ref and cannot drive rendering. This one is for display.
  const [sentences, setSentences] = useState<string[]>([]);
  const initialized = useRef(false);

  // Read the saved rate in an effect rather than during render, so the server
  // and the first client render agree on the 1.0x default.
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
    if (stored >= MIN_RATE && stored <= MAX_RATE) {
      speech.setRate(stored);
    }
    // Runs once on mount; speech.setRate is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialized.current) return; // Prevent multiple streams
    initialized.current = true;

    const append = (sentence: string) => {
      setSentences((current) => [...current, sentence]);
      speech.enqueue(sentence);
    };

    // The opening needs no generation, so playback starts before the model has
    // returned anything — which also buys it a head start over the voice.
    append(buildOpeningLine(props.title, props.author, props.feedTitle));
    speech.playFrom(0);

    const streamScript = async () => {
      const { output } = await streamAudioScript(props.articleId);

      let buffer = "";
      for await (const delta of readStreamableValue(output)) {
        buffer += delta ?? "";
        const { sentences: complete, remainder } = splitIntoSentences(buffer);
        buffer = remainder;
        complete.forEach(append);
      }

      // A stream often ends without terminal punctuation, so whatever is left
      // is spoken as a final sentence.
      if (buffer.trim()) {
        append(buffer.trim());
      }
    };

    void streamScript();
    // Guarded by initialized; speech callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.articleId]);

  const togglePlayback = () => {
    if (speech.paused) return speech.resume();
    if (speech.speaking) return speech.pause();
    speech.playFrom(0);
  };

  const changeRate = ([next]: number[]) => {
    speech.setRate(next);
    window.localStorage.setItem(RATE_STORAGE_KEY, String(next));
  };

  const playing = speech.speaking && !speech.paused;

  return (
    <div className="flex flex-col gap-6">
      {!speech.supported && (
        <Alert>
          <AlertTitle>Playback unavailable</AlertTitle>
          <AlertDescription>
            This browser has no speech voices installed, so the briefing cannot
            be read aloud. The transcript below is still generated.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-lg leading-relaxed text-pretty">
        {sentences.map((sentence, index) => (
          <span
            key={index}
            data-active={index === speech.activeIndex}
            className="data-[active=true]:bg-primary/15 rounded transition-colors"
          >
            {sentence}{" "}
          </span>
        ))}
      </p>

      <div className="flex flex-wrap items-center gap-4 border-t pt-4">
        <Button
          variant="secondary"
          size="icon"
          className="cursor-pointer"
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlayback}
          disabled={!speech.supported}
        >
          {playing ? (
            <PauseIcon className="size-4 fill-current" />
          ) : (
            <PlayIcon className="size-4 fill-current" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          aria-label="Restart"
          onClick={() => speech.playFrom(0)}
          disabled={!speech.supported}
        >
          <RotateCcwIcon className="size-4" />
        </Button>

        <div className="flex flex-1 items-center gap-3">
          <Label
            htmlFor="speech-rate"
            className="text-muted-foreground text-sm"
          >
            Speed
          </Label>
          <Slider
            id="speech-rate"
            className="max-w-40"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.1}
            value={[speech.rate]}
            onValueChange={changeRate}
            disabled={!speech.supported}
          />
          <span className="text-muted-foreground text-sm tabular-nums">
            {speech.rate.toFixed(1)}×
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioSummaryPlayer;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
`npx vitest run --project components tests/components/article/audio-summary-player.test.tsx`

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/article/audio-summary-player.tsx tests/components/article/audio-summary-player.test.tsx
git commit -m "$(cat <<'EOF'
feat: play audio summaries while the transcript streams in

The player speaks the constructed opening immediately, then feeds each
completed sentence of the generated script into the speech queue as it arrives,
so audio begins without waiting for generation to finish.

The sentence the engine reports as started is highlighted in the transcript.
Driving that from the engine's own start events rather than a timer means the
highlight cannot drift out of sync with the audio.

The speed slider is stored per device in local storage, since the same rate
value sounds different on different speech engines and a synced value would
arrive wrong on a second device.

Where no speech voices are installed the page says so and still renders the
transcript, rather than silently offering nothing.

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The audio summary route

**Files:**

- Create: `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`
- Create: `src/components/article/audio-summary-article-actions.tsx`
- Test: `tests/unit/audioSummaryPageLayout.test.ts`

**Interfaces:**

- Consumes: `AudioSummaryPlayer` (Task 5); `ArticleCardActions` with
  `currentPage` (Task 3).
- Produces: the route the speaker icon has been pointing at since Task 3.

The layout test mirrors the existing `tests/unit/aiSummaryPageLayout.test.ts`,
which asserts against the page source because server components are not rendered
by the component suite.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/audioSummaryPageLayout.test.ts`:

```ts
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve(
    __dirname,
    "../../src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx",
  ),
  "utf8",
);

describe("Audio summary page layout", () => {
  it("aligns the visible Back button content with the article rail", () => {
    expect(pageSource).toContain('<article className="mx-auto flex max-w-4xl');
    expect(pageSource).toContain('<div className="-ml-3 self-start">');
    expect(pageSource).toContain("<BackButton />");
  });

  it("passes the article's own metadata to the player", () => {
    // The opening line is built from these, so they must reach the client.
    expect(pageSource).toContain("<AudioSummaryPlayer");
    expect(pageSource).toContain("feedTitle={article.feed.title}");
    expect(pageSource).toContain("author={article.scrape?.author}");
  });

  it("explains itself when the article body could not be retrieved", () => {
    expect(pageSource).toContain("Audio summary unavailable");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project node tests/unit/audioSummaryPageLayout.test.ts`

Expected: FAIL — `ENOENT: no such file or directory` for the page.

- [ ] **Step 3: Create the actions wrapper**

Create `src/components/article/audio-summary-article-actions.tsx`:

```tsx
"use client";

import ArticleCardActions from "@/components/article/article-card-actions";
import { Prisma } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import readingTime from "reading-time";

type Article = Prisma.ArticleGetPayload<{
  include: { feed: true; scrape: true };
}>;

const AudioSummaryArticleActions = ({ article }: { article: Article }) => {
  const router = useRouter();
  const articleReadingTime = article.scrape
    ? readingTime(article.scrape.textContent)
    : undefined;

  return (
    <ArticleCardActions
      article={article}
      currentPage="audio-summary"
      readingTime={articleReadingTime}
      onAfterDismiss={() => router.back()}
    />
  );
};

export default AudioSummaryArticleActions;
```

- [ ] **Step 4: Create the page**

Create `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`:

```tsx
"use server";

import ArticleMeta from "@/components/article/article-meta";
import AudioSummaryArticleActions from "@/components/article/audio-summary-article-actions";
import AudioSummaryPlayer from "@/components/article/audio-summary-player";
import IntlRelativeTime from "@/components/intl-relative-time";
import BackButton from "@/components/navigation/back-button";
import TopNavigation from "@/components/navigation/top-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

const AudioSummary = async (props0: {
  params: Promise<{ feedId: string; articleId: string }>;
}) => {
  const params = await props0.params;
  const articleId = parseInt(params.articleId);

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

  return (
    <div className="m-2 flex flex-col gap-2">
      <TopNavigation
        segments={[
          { name: "Feeds", href: "/feed" },
          { name: article.feed.title, href: `/feed/${article.feed.id}` },
        ]}
        page="Audio Summary"
      />

      <article className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="-ml-3 self-start">
          <BackButton />
        </div>
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
          <AudioSummaryPlayer
            articleId={article.id}
            author={article.scrape?.author}
            feedTitle={article.feed.title}
            title={article.title}
          />
        ) : (
          <Alert className="mx-auto my-12 max-w-md">
            <AlertTitle>Audio summary unavailable</AlertTitle>
            <AlertDescription>
              The article content could not be retrieved, so an audio briefing
              cannot be generated.
            </AlertDescription>
          </Alert>
        )}
        <div className="text-muted-foreground text-xs">
          Source: <Link href={article.link}>{article.link}</Link>
        </div>
        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:gap-2">
          <AudioSummaryArticleActions article={article} />
        </div>
      </article>
    </div>
  );
};

export default AudioSummary;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --project node tests/unit/audioSummaryPageLayout.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 6: Verify the whole project**

Run: `npm run test && npm run lint && npm run build && npm run format:check`

Expected: all four succeed. If `format:check` fails, run `npm run format` and
re-check.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add the audio summary page

Adds the route the speaker icon points at. The page mirrors the AI summary
page's header, back button, and source line, and shows the same style of
explanation when the article body could not be retrieved.

The title, author, and feed are passed to the player so it can build the spoken
introduction locally, without a round trip to the model.

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Manual browser verification

Two behaviours cannot be settled by the test suite, because both are browser
quirks that the fake speech engine cannot reproduce. Do not skip this task — the
keepalive removal in Task 4 is explicitly conditional on the first check.

**Files:** none unless a check fails.

- [ ] **Step 1: Start the app**

Run: `npm run dev`

Open an article card and press the speaker icon (or select a card and press
`a`).

- [ ] **Step 2: Verify the script plays to the end without truncation**

Listen to a full briefing, start to finish.

Expected: playback runs to the last sentence. Chrome's roughly 15-second cut-off
applies to a single long utterance, and sentences here run about five seconds,
so per-sentence queueing should sidestep it.

**If playback truncates:** reinstate the keepalive in
`src/hooks/use-speech-synthesis.ts` — a `setInterval` under 15 seconds calling
`window.speechSynthesis.pause()` then `.resume()`, started in `playFrom` and
cleared in `cancel` and on unmount. It **must** be suspended while `paused` is
true, or it will resume playback the reader deliberately paused. Add a test
asserting the keepalive does not fire while paused, and commit separately.

- [ ] **Step 3: Verify autoplay on a client-side navigation**

From the feed, press the speaker icon.

Expected: audio starts on its own. The click is a user activation and the App
Router navigates without a document load, so the activation carries.

- [ ] **Step 4: Verify the blocked-autoplay fallback**

Copy the audio page URL, open a new tab, paste it, and load it directly.

Expected: if the browser refuses to speak without activation, the transport
shows Play and pressing it starts playback. Nothing else is broken.

**If the transport instead shows Pause while silent,** the optimistic `speaking`
state is wrong for this path. Fix it in `AudioSummaryPlayer` by not calling
`speech.playFrom(0)` on mount when
`navigator.userActivation?.hasBeenActive === false`, so the page simply waits at
Play. Commit separately.

- [ ] **Step 5: Verify the rate slider**

While a briefing is playing, drag the speed slider.

Expected: the speed changes within a sentence or two — the current sentence
restarts at the new rate rather than the change taking effect only at the end.
Reload the page and confirm the slider comes back at the chosen value.

- [ ] **Step 6: Verify the highlight**

Watch the transcript during playback.

Expected: the highlighted sentence matches the one being spoken, and stays
matched through a pause and resume.

- [ ] **Step 7: Record the outcome**

If every check passed, no commit is needed — say so in the completion report. If
any check required a fix, confirm
`npm run test && npm run lint && npm run build` still pass after it.

---

## Self-Review

**Spec coverage.** Every section of the design maps to a task: navigation and
the `currentPage` prop (Task 3), the route (Task 6), the constructed opening
(Task 1), generation (Task 2), sentence splitting (Task 1), playback and the
queue rewrite (Tasks 4 and 5), speech rate with localStorage (Task 5), the
failure-mode table (Tasks 5 and 6), and the keepalive verification the spec
explicitly demanded (Task 7). The non-goals stay out: no persistence, no
`AbortSignal`, no auto-scroll, no voice picker, no author normalisation.

**Type consistency.** `buildOpeningLine(title, author, feedTitle)` is called
with that argument order in Task 5. `splitIntoSentences` returns
`{ sentences, remainder }` in Task 1 and is destructured that way in Task 5. The
hook's `SpeechSynthesisControls` members defined in Task 4 — `activeIndex`,
`enqueue`, `playFrom`, `pause`, `resume`, `setRate`, `rate`, `speaking`,
`paused`, `supported` — are the only ones Task 5 uses. `AudioSummaryPlayer`
props declared in Task 5 match the page's usage in Task 6, and the `author` type
is `string | null | undefined` in both, matching `article.scrape?.author`.

**One known intermediate state,** called out at the top and again in Task 3: the
speaker icon links to a 404 between Tasks 3 and 6. This is what allows Task 4 to
rewrite the hook with no consumer bound to the old API. Tests, lint, and build
stay green at every commit.
