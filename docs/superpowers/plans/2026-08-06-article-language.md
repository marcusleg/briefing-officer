# Language-Aware Article Processing Implementation Plan

> **Status:** Implemented, shipped in `546556b`. This is a historical planning
> record kept for the reasoning behind the design; it is not maintained and its
> details have since drifted from the code.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record each article's language and state it explicitly in every
prompt, so a non-English article gets a lead, text summary, and audio briefing
in its own language, spoken by a matching voice.

**Architecture:** The model reports the article's language as a
structured-output field alongside the lead already generated for every article
at ingest. The value is validated and stored on `Article.language`; `null` means
"never established" and resolves to English. All three prompts embed an explicit
language directive. The audio briefing's introduction moves from hand-assembled
code into the prompt, and the model delimits sentences with newlines so sentence
splitting needs no language-specific knowledge.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7 (SQLite), Vercel AI
SDK (`ai@7`), Zod 4, Vitest (`node` and `components` projects), Web Speech API.

Full design: `docs/superpowers/specs/2026-08-06-article-language-design.md`.

## Global Constraints

- Branch is `feat/article-language`, already created. Do **not** push to `main`.
- Conventional Commits **without scopes** (`feat:`, `fix:`, `test:`,
  `refactor:`, `docs:`, `chore:`). `feat:`/`fix:` first lines are user-facing
  changelog copy.
- Never bypass the Husky pre-commit hook (`--no-verify` is prohibited). Run
  `npm run format` before committing if the hook reports unfixable formatting.
- Language codes stored in the database are always lowercase two-letter ISO
  639-1, or `null`. Never store `"und"`, `"deu"`, or a region suffix.
- The application's own interface stays English. Only article-derived text is
  translated.
- `tests/integration/feedRepository.test.ts` already fails `npx tsc --noEmit` on
  `main` (its `feedItem` factory is missing the `author` field added in
  d6d61c7). Pre-existing, unrelated, does not gate `npm run build`. Do not fix
  it here and do not be misled by it.
- Verification commands: `npm run test` (all Vitest projects),
  `npx vitest run --project node`, `npx vitest run --project components`,
  `npm run lint`, `npm run build`.

## File Structure

**Created:**

- `src/lib/language.ts` — the only place that decides whether a model-supplied
  language code is storable, and the only place that maps a code to a display
  name. Imported by both server (prompts) and client (player).
- `tests/unit/language.test.ts`
- `prisma/migrations/20260806000000_add_article_language/migration.sql`

**Modified:**

- `prisma/schema.prisma` — `Article.language String?`
- `src/lib/ai/prompts.ts` — language directive helper; all three prompt builders
- `src/lib/ai/services/leadService.ts` — `generateText` → `generateObject`;
  writes the language
- `src/lib/ai/services/summaryService.ts` — passes the language through
- `src/lib/ai/services/audioScriptService.ts` — passes language, author, and
  feed title through
- `src/lib/audio-script.ts` — `buildOpeningLine` deleted; `splitIntoSentences`
  becomes a newline split
- `src/hooks/use-speech-synthesis.ts` — voice matching and a `voiceAvailable`
  signal
- `src/components/article/audio-summary-player.tsx` — new props, no constructed
  opening, missing-voice alert
- `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx` — passes
  `language` instead of `title`/`author`/`feedTitle`
- `tests/unit/prompts.test.ts`, `tests/unit/audio-script.test.ts`,
  `tests/unit/audioSummaryPageLayout.test.ts`
- `tests/integration/leadService.test.ts`
- `tests/helpers/speech-synthesis.ts`
- `tests/components/hooks/use-speech-synthesis.test.tsx`
- `tests/components/article/audio-summary-player.test.tsx`

---

### Task 1: The language module

**Files:**

- Create: `src/lib/language.ts`
- Test: `tests/unit/language.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `DEFAULT_LANGUAGE: "en"`
  - `normalizeLanguage(value: string | null | undefined): string | null`
  - `languageDisplayName(language: string | null): string`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/language.test.ts`:

```ts
import { languageDisplayName, normalizeLanguage } from "@/lib/language";
import { describe, expect, it } from "vitest";

describe("normalizeLanguage", () => {
  it("accepts a two-letter ISO 639-1 code", () => {
    expect(normalizeLanguage("de")).toBe("de");
    expect(normalizeLanguage("en")).toBe("en");
  });

  it("reduces a regional tag to its primary subtag", () => {
    // Engines and models disagree on the separator.
    expect(normalizeLanguage("de-DE")).toBe("de");
    expect(normalizeLanguage("de_DE")).toBe("de");
    expect(normalizeLanguage("pt-BR")).toBe("pt");
  });

  it("lowercases and trims", () => {
    expect(normalizeLanguage("DE")).toBe("de");
    expect(normalizeLanguage("  de  ")).toBe("de");
  });

  it("rejects the undetermined sentinel", () => {
    // Load-bearing: Intl.DisplayNames.of("und") returns "root", so the
    // recognition check does NOT catch it. Only the two-letter rule does.
    expect(normalizeLanguage("und")).toBeNull();
  });

  it("rejects ISO 639-2 codes", () => {
    // Load-bearing for the same reason: .of("deu") returns "German".
    expect(normalizeLanguage("deu")).toBeNull();
    expect(normalizeLanguage("ger")).toBeNull();
  });

  it("rejects language names and unrecognised codes", () => {
    expect(normalizeLanguage("German")).toBeNull();
    expect(normalizeLanguage("xx")).toBeNull();
    expect(normalizeLanguage("un")).toBeNull();
  });

  it("rejects empty and missing values without throwing", () => {
    // Intl.DisplayNames.of("") throws a RangeError, so the shape check has to
    // run first.
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage("   ")).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });
});

describe("languageDisplayName", () => {
  it("names a language in English", () => {
    expect(languageDisplayName("de")).toBe("German");
    expect(languageDisplayName("fr")).toBe("French");
  });

  it("falls back to English when no language was established", () => {
    expect(languageDisplayName(null)).toBe("English");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project node tests/unit/language.test.ts` Expected: FAIL
— cannot resolve `@/lib/language`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/language.ts`:

```ts
/**
 * The language an article's generated text is written in.
 *
 * The model reports a language alongside the lead it generates (see
 * leadService). Only values that survive `normalizeLanguage` are stored, and a
 * null language means "never established", which resolves to English wherever
 * it is read.
 */

export const DEFAULT_LANGUAGE = "en";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

/**
 * Reduces a model-supplied language to a storable ISO 639-1 code, or null.
 *
 * The order of the checks is load-bearing:
 *
 * - `Intl.DisplayNames.of("")` throws a RangeError rather than returning a
 *   value, so the shape check is what keeps the lookup below safe.
 * - `.of("deu")` returns "German" and `.of("und")` returns "root", so neither
 *   ISO 639-2 codes nor the undetermined sentinel are caught by the
 *   recognition check. The two-letter rule is the only thing that rejects
 *   them. Reordering these would store both — and set them as
 *   `utterance.lang`, where no browser matches them to a voice.
 */
export const normalizeLanguage = (
  value: string | null | undefined,
): string | null => {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0] ?? "";

  if (!/^[a-z]{2}$/.test(code)) {
    return null;
  }

  // A well-formed but unrecognised tag echoes itself back.
  return languageNames.of(code) === code ? null : code;
};

/**
 * The English name of a language, for prompt directives and reader-facing
 * copy. The interface is English, so the names are too.
 */
export const languageDisplayName = (language: string | null): string =>
  languageNames.of(language ?? DEFAULT_LANGUAGE) ?? "English";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project node tests/unit/language.test.ts` Expected: PASS,
9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/language.ts tests/unit/language.test.ts
git commit -m "feat: add language code validation and naming"
```

---

### Task 2: Language directives in the lead and summary prompts

**Files:**

- Modify: `src/lib/ai/prompts.ts`
- Test: `tests/unit/prompts.test.ts`

**Interfaces:**

- Consumes: `languageDisplayName` from Task 1.
- Produces:
  - `buildLeadPrompt(title: string, textContent: string): string` — signature
    unchanged; now instructs the model to report a language.
  - `buildSummaryPrompt(title: string, textContent: string, language: string | null): string`
  - `systemPrompt` — unchanged.
  - `buildAudioScriptPrompt` — **not** touched in this task; Task 4 rewrites it.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/prompts.test.ts`, replace the `describe("buildLeadPrompt", …)`
and `describe("buildSummaryPrompt", …)` blocks with:

```ts
describe("buildLeadPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here");
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("no longer than 80 words");
  });

  it("asks the model to report the language as an ISO 639-1 code", () => {
    // The lead is the one call that determines the language; everything
    // downstream reads what it stored.
    const prompt = buildLeadPrompt("My Title", "Body text here");
    expect(prompt).toContain("ISO 639-1");
    expect(prompt).toContain('"und"');
  });

  it("asks for the lead in the language it reports", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here");
    expect(prompt).toContain("in the language you reported");
  });
});

describe("buildSummaryPrompt", () => {
  it("includes the article text and Markdown structure cues", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here", null);
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("Key Facts");
    expect(prompt).toContain("Key Takeaways");
  });

  it("names the article's language", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here", "de");
    expect(prompt).toContain("Write entirely in German.");
  });

  it("falls back to English when no language was established", () => {
    const prompt = buildSummaryPrompt("My Title", "Body text here", null);
    expect(prompt).toContain("Write entirely in English.");
  });

  it("asks for the heading to be translated too", () => {
    // The heading names are given in English as selection criteria, so
    // without this a German summary gets German bullets under an English
    // heading.
    const prompt = buildSummaryPrompt("My Title", "Body text here", "de");
    expect(prompt).toContain("translate the one you choose");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/unit/prompts.test.ts` Expected: FAIL —
`buildSummaryPrompt` takes 2 arguments, and the new assertions find no matching
text.

- [ ] **Step 3: Write the implementation**

In `src/lib/ai/prompts.ts`, add the import and helper at the top (leave
`systemPrompt` as it is):

```ts
import { languageDisplayName } from "@/lib/language";

/**
 * The instruction that makes the output language deliberate rather than
 * inferred. Stated even when the language is English: the point is that every
 * generation is told what to write in, not that non-English is special-cased.
 */
const languageDirective = (language: string | null) =>
  `Write entirely in ${languageDisplayName(language)}.`;
```

Replace `buildLeadPrompt`:

```ts
export const buildLeadPrompt = (title: string, textContent: string) =>
  `Write a single paragraph summarizing what the article covers and why it is significant or timely. Be factual and objective. The summary must be no longer than 80 words. Do not copy the article's opening lines verbatim, and do not add introductory phrases, headings, or filler.

First determine the language the article is written in and report it as a two-letter ISO 639-1 code, for example "de" for German. If the language cannot be established, report "und". Write the lead in the language you reported.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;
```

Replace `buildSummaryPrompt`:

```ts
export const buildSummaryPrompt = (
  title: string,
  textContent: string,
  language: string | null,
) =>
  `Write a summary using the following Markdown structure: Use a level 3 heading (###) titled "Key Facts" for news and factual reporting, "Key Takeaways" for opinion or commentary, or "Key Points" if the article type is unclear. Follow the heading with a bullet list of 5–12 bullets — fewer for short or focused articles, more for complex ones. Each bullet must be one concise sentence. Bold the single most important named entity, concept, or figure in each bullet.

${languageDirective(language)} The heading names above are given in English; translate the one you choose into that language.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project node tests/unit/prompts.test.ts` Expected: The
`buildLeadPrompt` and `buildSummaryPrompt` suites PASS. The
`buildAudioScriptPrompt` suite still passes untouched.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/prompts.ts tests/unit/prompts.test.ts
git commit -m "feat: state the output language in the lead and summary prompts"
```

---

### Task 3: Store the language, and read it in the text summary

**Files:**

- Create: `prisma/migrations/20260806000000_add_article_language/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/ai/services/leadService.ts`
- Modify: `src/lib/ai/services/summaryService.ts`
- Test: `tests/integration/leadService.test.ts`

**Interfaces:**

- Consumes: `normalizeLanguage` (Task 1); `buildLeadPrompt`,
  `buildSummaryPrompt` (Task 2).
- Produces: `Article.language: string | null` in the Prisma client.
  `generateAiLead(articleId: number): Promise<string>` — return type unchanged,
  still the lead text.

- [ ] **Step 1: Add the column**

In `prisma/schema.prisma`, add `language` to the `Article` model, directly after
`author`:

```prisma
author          String?
language        String?
```

Create `prisma/migrations/20260806000000_add_article_language/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Article" ADD COLUMN "language" TEXT;
```

Then regenerate the client:

```bash
npm run prisma:generate
```

Expected: "Generated Prisma Client". Tests apply the schema with
`prisma db push` (see `vitest.setup.ts`), so they pick the column up without the
migration; the migration file is what production deployments run.

- [ ] **Step 2: Write the failing tests**

Replace the whole of `tests/integration/leadService.test.ts` with:

```ts
import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

// Mock the AI registry's top-level model and the `ai` SDK BEFORE importing the service.
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: { language: "en", lead: "Generated lead." },
    usage: { inputTokens: 7, outputTokens: 3 },
  })),
}));

import { generateAiLead } from "@/lib/ai/services/leadService";

const mockGeneration = (language: string, lead = "Generated lead.") =>
  vi.mocked(generateObject).mockResolvedValueOnce({
    object: { language, lead },
    usage: { inputTokens: 7, outputTokens: 3 },
  } as never);

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("generateAiLead", () => {
  it("stores the generated lead and records token usage", async () => {
    const article = await createArticle({ userId, feedId });

    const result = await generateAiLead(article.id);

    expect(result).toBe("Generated lead.");
    const lead = await prisma.articleLead.findUniqueOrThrow({
      where: { articleId: article.id },
    });
    expect(lead.text).toBe("Generated lead.");

    const usage = await prisma.tokenUsage.findFirstOrThrow({
      where: { userId },
    });
    expect(usage.inputTokens).toBe(7);
    expect(usage.outputTokens).toBe(3);
  });

  it("stores the language the model reported", async () => {
    const article = await createArticle({ userId, feedId });
    mockGeneration("de");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.language).toBe("de");
  });

  it("normalises a regional tag before storing it", async () => {
    const article = await createArticle({ userId, feedId });
    mockGeneration("de-DE");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.language).toBe("de");
  });

  it("stores no language when the model reports it as undetermined", async () => {
    const article = await createArticle({ userId, feedId });
    mockGeneration("und");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    });
    expect(stored.language).toBeNull();
  });

  it("keeps the lead when the reported language is unusable", async () => {
    // A bad language code must not cost the reader their lead.
    const article = await createArticle({ userId, feedId });
    mockGeneration("German", "Trotzdem ein Lead.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { lead: true },
    });
    expect(stored.language).toBeNull();
    expect(stored.lead?.text).toBe("Trotzdem ein Lead.");
  });

  it("replaces an existing lead rather than failing", async () => {
    const article = await createArticle({ userId, feedId });
    await generateAiLead(article.id);
    mockGeneration("fr", "Un nouveau lead.");

    await generateAiLead(article.id);

    const stored = await prisma.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { lead: true },
    });
    expect(stored.lead?.text).toBe("Un nouveau lead.");
    expect(stored.language).toBe("fr");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/integration/leadService.test.ts`
Expected: FAIL — the service still imports `generateText`, which the mock no
longer provides.

- [ ] **Step 4: Rewrite the lead service**

Replace `src/lib/ai/services/leadService.ts` with:

```ts
"use server";

import { buildLeadPrompt, systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import { normalizeLanguage } from "@/lib/language";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { z } from "zod";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

// `language` is declared before `lead` deliberately. Structured output is
// generated field by field, so the model commits to a language and then writes
// the lead in it, rather than reporting one after the fact.
//
// "und" is the registered code for "undetermined". It is described explicitly
// because it is the one permitted value that is not an ISO 639-1 code —
// "two letters, or this one three-letter word" otherwise reads as a
// contradiction and invites "un" or "unknown" instead. Nothing special-cases
// it downstream: normalizeLanguage rejects it on length, like any other
// unusable value.
const leadSchema = z.object({
  language: z
    .string()
    .describe(
      'The article\'s language as a two-letter ISO 639-1 code, for example "de". Use "und" — the standard code for "undetermined" — if the language cannot be established.',
    ),
  lead: z.string(),
});

export const generateAiLead = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { scrape: true },
    where: { id: articleId },
  });

  const { object, usage } = await generateObject({
    model,
    schema: leadSchema,
    system: systemPrompt,
    prompt: buildLeadPrompt(article.title, article.scrape?.textContent ?? ""),
  });

  const language = normalizeLanguage(object.language);

  // One nested write, so the language cannot drift out of step with the lead
  // it was determined alongside.
  await prisma.article.update({
    where: { id: articleId },
    data: {
      language,
      lead: {
        upsert: {
          create: { text: object.lead },
          update: { text: object.lead },
        },
      },
    },
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
  );

  logger.info(
    {
      articleId,
      feedId: article.feedId,
      language,
      model: model.modelId,
      tokenUsage: usage,
    },
    "AI lead generated.",
  );

  return object.lead;
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project node tests/integration/leadService.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Pass the language into the summary**

In `src/lib/ai/services/summaryService.ts`, change the `buildSummaryPrompt` call
to pass the stored language:

```ts
      prompt: buildSummaryPrompt(
        article.title,
        article.scrape?.textContent ?? "",
        article.language,
      ),
```

And add `language` to the log payload so a wrong-language summary is diagnosable
without reproducing it:

```ts
logger.info(
  {
    articleId,
    feedId: article.feedId,
    language: article.language,
    model: model.modelId,
    tokenUsage,
  },
  "AI summary generated.",
);
```

- [ ] **Step 7: Verify nothing else broke**

Run: `npx vitest run --project node` Expected: PASS.
(`tests/integration/feedRepository.test.ts` runs fine — its known problem is a
typecheck-only issue.)

Run: `npm run lint` Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/ai/services/leadService.ts src/lib/ai/services/summaryService.ts tests/integration/leadService.test.ts
git commit -m "feat: write summaries in the language of the article"
```

---

### Task 4: The audio briefing writes its own introduction

**Files:**

- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/audio-script.ts`
- Modify: `src/lib/ai/services/audioScriptService.ts`
- Test: `tests/unit/prompts.test.ts`, `tests/unit/audio-script.test.ts`

**Interfaces:**

- Consumes: `languageDirective` (Task 2, module-private), `articleAuthor` from
  `@/lib/article`, `Article.language` (Task 3).
- Produces:
  - `buildAudioScriptPrompt(args: { title: string; author: string | null; feedTitle: string; textContent: string; language: string | null }): string`
  - `splitIntoSentences(buffer: string): { sentences: string[]; remainder: string }`
    — contract unchanged, implementation now a newline split.
  - `buildOpeningLine` — **deleted**. Task 6 removes its last caller.

- [ ] **Step 1: Write the failing prompt tests**

In `tests/unit/prompts.test.ts`, replace the whole
`describe("buildAudioScriptPrompt", …)` block with:

```ts
describe("buildAudioScriptPrompt", () => {
  const args = {
    title: "My Title",
    author: "Jane Doe",
    feedTitle: "Hacker News",
    textContent: "Body text here",
    language: null as string | null,
  };

  it("includes the title, the article text, and the publication", () => {
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("Hacker News");
  });

  it("asks for spoken prose of about one minute", () => {
    expect(buildAudioScriptPrompt(args)).toContain("150 to 200 words");
  });

  it("forbids Markdown, since the output is spoken rather than rendered", () => {
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("plain text only");
  });

  it("asks the model to introduce the article itself", () => {
    // The introduction used to be assembled in code; the model writes it now
    // so it is phrased naturally in the article's own language.
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("state its title exactly as given");
    expect(prompt).not.toContain("already been introduced");
  });

  it("supplies the author when one is known", () => {
    const prompt = buildAudioScriptPrompt(args);
    expect(prompt).toContain("<author>Jane Doe</author>");
    expect(prompt).toContain("Name the author too.");
  });

  it("omits the author entirely when none is known", () => {
    // Structural guard: with no author element in the prompt there is nothing
    // for the model to invent one from.
    const prompt = buildAudioScriptPrompt({ ...args, author: null });
    expect(prompt).not.toContain("<author>");
    expect(prompt).toContain("do not mention one");
  });

  it("asks for one sentence per line", () => {
    // Playback splits the stream on newlines, so this instruction is what
    // makes sentence boundaries work in every language.
    expect(buildAudioScriptPrompt(args)).toContain("own line");
  });

  it("names the article's language", () => {
    const prompt = buildAudioScriptPrompt({ ...args, language: "de" });
    expect(prompt).toContain("Write entirely in German.");
  });

  it("falls back to English when no language was established", () => {
    expect(buildAudioScriptPrompt(args)).toContain(
      "Write entirely in English.",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/unit/prompts.test.ts` Expected: FAIL —
`buildAudioScriptPrompt` still takes positional arguments.

- [ ] **Step 3: Rewrite the audio script prompt**

In `src/lib/ai/prompts.ts`, replace `buildAudioScriptPrompt` with:

```ts
/**
 * Takes an object rather than positional arguments: four of the five fields
 * are strings, and three of those are freely transposable at a call site
 * without a type error.
 */
export const buildAudioScriptPrompt = ({
  title,
  author,
  feedTitle,
  textContent,
  language,
}: {
  title: string;
  author: string | null;
  feedTitle: string;
  textContent: string;
  language: string | null;
}) => {
  // Omitted rather than left empty when unknown, so there is nothing in the
  // prompt for the model to invent an author from.
  const authorInstruction = author
    ? " Name the author too."
    : " No author is known, so do not mention one.";
  const authorElement = author ? `<author>${author}</author>\n` : "";

  return `Write a spoken audio briefing that a text-to-speech voice will read aloud.

Open by introducing the article: state its title exactly as given below, without paraphrasing or translating it, then name the publication.${authorInstruction} Do not open with a greeting.

After the introduction, write 150 to 200 words of continuous prose — roughly one minute of speech. Use short declarative sentences. Connect them with explicit transitions so the briefing flows when heard rather than read. Write numbers, symbols, and units the way they are spoken, for example "forty percent" rather than "40%". Avoid parenthetical asides, which cannot be heard.

Put each sentence on its own line, separated by a single newline. Do not leave blank lines between sentences.

Output plain text only. Do not use Markdown, headings, bullet lists, bold, or italics.

${languageDirective(language)}

<article>
<title>${title}</title>
${authorElement}<publication>${feedTitle}</publication>
<content>
${textContent}
</content>
</article>`;
};
```

- [ ] **Step 4: Run the prompt tests to verify they pass**

Run: `npx vitest run --project node tests/unit/prompts.test.ts` Expected: PASS,
all suites.

- [ ] **Step 5: Write the failing splitter tests**

Replace the whole of `tests/unit/audio-script.test.ts` with:

```ts
import { splitIntoSentences } from "@/lib/audio-script";
import { describe, expect, it } from "vitest";

describe("splitIntoSentences", () => {
  it("returns complete lines and keeps the unterminated tail", () => {
    expect(
      splitIntoSentences("Linux 7.2 drops strncpy.\nIt landed Fri"),
    ).toEqual({
      sentences: ["Linux 7.2 drops strncpy."],
      remainder: "It landed Fri",
    });
  });

  it("finds several sentences in one buffer", () => {
    expect(splitIntoSentences("One.\nTwo.\nThree")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("holds everything back until a newline arrives", () => {
    expect(splitIntoSentences("It cost 3.")).toEqual({
      sentences: [],
      remainder: "It cost 3.",
    });
  });

  it("does not split on punctuation inside a line", () => {
    // The whole point of delimiting on newlines: no abbreviation list, so
    // "z.B." and "Dr." are equally safe in any language.
    expect(
      splitIntoSentences("Laut Dr. Schmidt, z.B. in Berlin, gilt das.\nDann"),
    ).toEqual({
      sentences: ["Laut Dr. Schmidt, z.B. in Berlin, gilt das."],
      remainder: "Dann",
    });
  });

  it("keeps a sentence whole across an abbreviation no English list knew", () => {
    // The discriminating case for the rewrite: the old punctuation splitter
    // fragmented this at "usw." because that abbreviation was absent from its
    // English list. Newline delimiting has no such list to be absent from.
    //
    // The test above does NOT discriminate — "dr" was in the old abbreviation
    // set and "z.B." ends in a single letter, which the old algorithm also
    // declined to split on, so it passes against both implementations. Keep
    // both: that one documents intent, this one proves the claim.
    expect(splitIntoSentences("Vorher usw. Nachher.\nDanach")).toEqual({
      sentences: ["Vorher usw. Nachher."],
      remainder: "Danach",
    });
  });

  it("ignores blank lines", () => {
    expect(splitIntoSentences("One.\n\nTwo.\nThree")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("trims surrounding whitespace from each sentence", () => {
    expect(splitIntoSentences("  One.  \n Two. \nThree")).toEqual({
      sentences: ["One.", "Two."],
      remainder: "Three",
    });
  });

  it("returns nothing for empty input", () => {
    expect(splitIntoSentences("")).toEqual({ sentences: [], remainder: "" });
  });

  it("survives being fed its own remainder with the next delta appended", () => {
    // How the player actually drives it, one streamed chunk at a time.
    const first = splitIntoSentences("One.\nTwo");
    expect(first.sentences).toEqual(["One."]);

    const second = splitIntoSentences(`${first.remainder} and a half.\nThree`);
    expect(second).toEqual({
      sentences: ["Two and a half."],
      remainder: "Three",
    });
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/unit/audio-script.test.ts` Expected:
FAIL — the punctuation splitter splits `"Laut Dr. Schmidt…"` in the wrong place
and never treats `"\n"` as a delimiter.

- [ ] **Step 7: Rewrite the splitter**

Replace the whole of `src/lib/audio-script.ts` with:

```ts
/**
 * Splits a buffer into complete sentences plus whatever is left over.
 *
 * The audio script prompt asks the model to put each sentence on its own line,
 * so the delimiter is a newline rather than something inferred from
 * punctuation. That keeps this free of language-specific knowledge: an English
 * abbreviation list would mis-split German ("z.B.") and every other language in
 * its own way.
 *
 * If the model ignores the instruction and emits no newlines at all, the whole
 * briefing arrives as one utterance and runs into the roughly 15 second
 * cut-off Chrome applies to a single long one. That is accepted rather than
 * defended against — see the design's note on the rejected length fallback.
 *
 * Safe to call repeatedly against a growing stream: feed the remainder back in
 * with the next delta appended.
 */
export const splitIntoSentences = (
  buffer: string,
): { sentences: string[]; remainder: string } => {
  const lines = buffer.split("\n");

  // Whatever follows the final newline is a sentence the stream has not
  // finished delivering. It is left untrimmed because the caller appends the
  // next delta directly to it.
  const remainder = lines.pop() ?? "";

  return {
    sentences: lines.map((line) => line.trim()).filter((line) => line !== ""),
    remainder,
  };
};
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project node tests/unit/audio-script.test.ts` Expected:
PASS, 9 tests.

Note: only the `usw.` case fails against the old splitter. The other eight pass
against both implementations, because the old algorithm treated `\n` as
sentence-terminating whitespace. Do not read their passing before the swap as a
sign the swap is unnecessary.

- [ ] **Step 9: Feed the prompt from the article**

Replace the `streamText` call in `src/lib/ai/services/audioScriptService.ts` so
the model receives everything the introduction needs. Add
`import { articleAuthor } from "@/lib/article";` at the top, and add
`feed: true` to the query's `include`:

```ts
const article = await prisma.article.findUniqueOrThrow({
  where: { id: articleId, userId },
  include: { feed: true, scrape: true },
});
```

```ts
const { textStream, totalUsage } = streamText({
  model,
  system: systemPrompt,
  prompt: buildAudioScriptPrompt({
    title: article.title,
    // The existing helper, so the feed-declared author keeps winning over
    // Readability's byline and no second notion of "the author" appears.
    author: articleAuthor(article),
    feedTitle: article.feed.title,
    textContent: article.scrape?.textContent ?? "",
    language: article.language,
  }),
});
```

And add `language` to the log payload:

```ts
logger.info(
  {
    articleId,
    feedId: article.feedId,
    language: article.language,
    model: model.modelId,
    tokenUsage,
  },
  "Audio script generated.",
);
```

- [ ] **Step 10: Verify the node suite**

Run: `npx vitest run --project node` Expected: PASS.

Run: `npm run lint` Expected: no errors. (The `components` project still fails
at this point — Task 6 updates the player. That is expected mid-plan.)

- [ ] **Step 11: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/audio-script.ts src/lib/ai/services/audioScriptService.ts tests/unit/prompts.test.ts tests/unit/audio-script.test.ts
git commit -m "feat: speak audio briefings in the language of the article"
```

---

### Task 5: Match the voice to the language

**Files:**

- Modify: `src/hooks/use-speech-synthesis.ts`
- Modify: `tests/helpers/speech-synthesis.ts`
- Test: `tests/components/hooks/use-speech-synthesis.test.tsx`

**Interfaces:**

- Consumes: `DEFAULT_LANGUAGE` from Task 1.
- Produces:
  `useSpeechSynthesis(language: string | null): SpeechSynthesisControls`, where
  `SpeechSynthesisControls` gains `voiceAvailable: boolean`. All existing
  members keep their names and types.

- [ ] **Step 1: Teach the test fakes about languages**

In `tests/helpers/speech-synthesis.ts`, add the two fields a real utterance
carries, to `FakeUtterance`:

```ts
export class FakeUtterance {
  text: string;
  rate = 1;
  lang = "";
  voice: unknown = undefined;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}
```

Change the default voice list in `installSpeechEngine` so voices carry a `lang`,
matching what a real engine reports:

```ts
export const installSpeechEngine = (
  voices: unknown[] = [{ name: "Test Voice", lang: "en-US" }],
) => {
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/components/hooks/use-speech-synthesis.test.tsx`, inside the
existing `describe("useSpeechSynthesis", …)` block:

```ts
it("speaks with a voice matching the article's language", () => {
  const german = { name: "Anna", lang: "de-DE" };
  const engine = installSpeechEngine([
    { name: "Test Voice", lang: "en-US" },
    german,
  ]);

  const { result } = renderHook(() => useSpeechSynthesis("de"));
  act(() => result.current.enqueue("Guten Tag."));
  act(() => result.current.playFrom(0));

  expect(result.current.voiceAvailable).toBe(true);
  expect(engine.spoken()[0].voice).toBe(german);
  expect(engine.spoken()[0].lang).toBe("de");
});

it("matches voices that report an underscore separator", () => {
  // Chrome reports "de-DE"; some Linux engines report "de_DE".
  const german = { name: "Anna", lang: "de_DE" };
  const engine = installSpeechEngine([german]);

  const { result } = renderHook(() => useSpeechSynthesis("de"));
  act(() => result.current.enqueue("Guten Tag."));
  act(() => result.current.playFrom(0));

  expect(engine.spoken()[0].voice).toBe(german);
});

it("leaves the voice unset when none matches, but still speaks", () => {
  const engine = installSpeechEngine([{ name: "Test Voice", lang: "en-US" }]);

  const { result } = renderHook(() => useSpeechSynthesis("de"));
  act(() => result.current.enqueue("Guten Tag."));
  act(() => result.current.playFrom(0));

  expect(result.current.supported).toBe(true);
  expect(result.current.voiceAvailable).toBe(false);
  // The engine gets its own fallback rather than an undefined voice, and
  // `lang` still tells it what it is reading.
  expect(engine.spoken()[0].voice).toBeUndefined();
  expect(engine.spoken()[0].lang).toBe("de");
});

it("treats a missing language as English", () => {
  const english = { name: "Test Voice", lang: "en-US" };
  const engine = installSpeechEngine([english]);

  const { result } = renderHook(() => useSpeechSynthesis(null));
  act(() => result.current.enqueue("Hello."));
  act(() => result.current.playFrom(0));

  expect(result.current.voiceAvailable).toBe(true);
  expect(engine.spoken()[0].voice).toBe(english);
  expect(engine.spoken()[0].lang).toBe("en");
});

it("finds a matching voice that loads late", () => {
  const voices: unknown[] = [];
  const engine = installSpeechEngine(voices);

  const { result } = renderHook(() => useSpeechSynthesis("de"));
  expect(result.current.voiceAvailable).toBe(false);

  voices.push({ name: "Anna", lang: "de-DE" });
  const [, listener] = engine.addEventListener.mock.calls[0];
  act(() => listener());

  expect(result.current.voiceAvailable).toBe(true);
});
```

Then make the existing tests compile against the new signature: replace
**every** occurrence of `useSpeechSynthesis()` in this file with
`useSpeechSynthesis("en")` — the hook now takes a required argument, so a bare
call is a type error. In "becomes supported once voices have loaded", also
change the pushed voice from `{ name: "Test Voice" }` to
`{ name: "Test Voice", lang: "en-US" }`, so it matches what a real engine
reports.

- [ ] **Step 3: Run the tests to verify they fail**

Run:
`npx vitest run --project components tests/components/hooks/use-speech-synthesis.test.tsx`
Expected: FAIL — `voiceAvailable` is undefined and utterances carry no `lang` or
`voice`.

- [ ] **Step 4: Implement voice matching**

In `src/hooks/use-speech-synthesis.ts`:

Add to the imports:

```ts
import { DEFAULT_LANGUAGE } from "@/lib/language";
```

Add `voiceAvailable` to the interface, keeping the members alphabetical as they
already are:

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
  voiceAvailable: boolean;
}
```

Change the signature and add the two new pieces of state:

```ts
export function useSpeechSynthesis(
  language: string | null,
): SpeechSynthesisControls {
  const [supported, setSupported] = React.useState(false);
  const [voiceAvailable, setVoiceAvailable] = React.useState(false);
```

Just below `const activeIndexValue = …`, add:

```ts
// Resolved once here so every utterance and the voice lookup agree on it.
const spokenLanguage = language ?? DEFAULT_LANGUAGE;

// Read at speak() time rather than through state, because sentences are
// handed to the engine as they stream in, outside a render.
const voice = React.useRef<SpeechSynthesisVoice | undefined>(undefined);
```

Replace the support effect with one that also resolves the voice:

```ts
React.useEffect(() => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  // getVoices() is populated asynchronously in Chrome, so an empty list only
  // means "no voices" after voiceschanged has fired. Linux without
  // speech-dispatcher installed never reports any.
  const syncVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    setSupported(voices.length > 0);

    // Engines disagree on the separator: Chrome reports "de-DE", some Linux
    // engines "de_DE".
    const match = voices.find(
      (candidate) =>
        candidate.lang?.toLowerCase().split(/[-_]/)[0] === spokenLanguage,
    );
    voice.current = match;
    setVoiceAvailable(match !== undefined);
  };

  syncVoices();
  window.speechSynthesis.addEventListener("voiceschanged", syncVoices);

  return () =>
    window.speechSynthesis?.removeEventListener("voiceschanged", syncVoices);
}, [spokenLanguage]);
```

In `speakSentence`, set the language and voice on each utterance, and add the
dependency:

```ts
const utterance = new SpeechSynthesisUtterance(sentences.current[index]);
utterance.rate = rateValue.current;
utterance.lang = spokenLanguage;

// Assigned only when a match exists: handing the engine an undefined
// voice is not the same as leaving it to pick its own default.
if (voice.current) {
  utterance.voice = voice.current;
}
```

```ts
    [spokenLanguage],
  );
```

Finally add `voiceAvailable` to the returned object, after `supported`:

```ts
    supported,
    voiceAvailable,
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
`npx vitest run --project components tests/components/hooks/use-speech-synthesis.test.tsx`
Expected: PASS. The player suite still fails — Task 6 fixes it.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-speech-synthesis.ts tests/helpers/speech-synthesis.ts tests/components/hooks/use-speech-synthesis.test.tsx
git commit -m "feat: read briefings with a voice matching the article's language"
```

---

### Task 6: Wire the player and the page

**Files:**

- Modify: `src/components/article/audio-summary-player.tsx`
- Modify: `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`
- Test: `tests/components/article/audio-summary-player.test.tsx`,
  `tests/unit/audioSummaryPageLayout.test.ts`

**Interfaces:**

- Consumes: `useSpeechSynthesis(language)` and `voiceAvailable` (Task 5);
  `languageDisplayName` (Task 1); `splitIntoSentences` (Task 4);
  `Article.language` (Task 3).
- Produces:
  `AudioSummaryPlayerProps = { articleId: number; language: string | null }`.

- [ ] **Step 1: Update the page-layout test**

In `tests/unit/audioSummaryPageLayout.test.ts`, replace the "passes the
article's own metadata to the player" test with:

```ts
it("passes the article's language to the player", () => {
  // The player needs it to pick a voice. The title, author, and publication
  // no longer travel to the client: the server action loads them itself for
  // the generated introduction.
  expect(pageSource).toContain("<AudioSummaryPlayer");
  expect(pageSource).toContain("language={article.language}");
  expect(pageSource).not.toContain("feedTitle={article.feed.title}");
});
```

- [ ] **Step 2: Update the player tests**

In `tests/components/article/audio-summary-player.test.tsx`, make these edits.

Change the streamed chunks so they are newline-delimited, in the
`vi.mock("@ai-sdk/rsc", …)` block:

```ts
vi.mock("@ai-sdk/rsc", () => ({
  readStreamableValue: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield "Kernel 7.2 removes strncpy, from Hacker News, by Jane Doe.\n";
      yield "It landed after 362 patches.\n";
      yield "Maintainers had warned for years.";
    },
  })),
}));
```

Replace the `props` object:

```ts
const props = {
  articleId: 42,
  language: "en",
};
```

Replace the first test ("speaks the constructed opening before any generated
text arrives") with:

```ts
  it("speaks nothing until the first generated sentence arrives", () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    // The introduction is generated now, so there is no locally-built opening
    // to play during the model's time to first token.
    expect(engine.speak).not.toHaveBeenCalled();
  });
```

In "speaks each generated sentence as it streams in", replace the expected
array:

```ts
      expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
        "Kernel 7.2 removes strncpy, from Hacker News, by Jane Doe.",
        "It landed after 362 patches.",
        "Maintainers had warned for years.",
      ]),
```

"highlights the sentence the engine reports as started" needs **no edit**: index
1 is still "It landed after 362 patches.", since the generated introduction now
occupies index 0 that the constructed opening used to.

In "restarts from the first sentence", replace the final assertion:

```ts
const respoken = engine.spoken().slice(3);
expect(respoken[0].text).toBe(
  "Kernel 7.2 removes strncpy, from Hacker News, by Jane Doe.",
);
```

Replace "keeps the spoken opening and explains itself when generation fails"
with:

```ts
  it("explains itself when generation fails", async () => {
    installSpeechEngine();
    vi.mocked(readStreamableValue).mockImplementationOnce(
      () =>
        ({
          async *[Symbol.asyncIterator]() {
            throw new Error("model unavailable");
          },
        }) as never,
    );

    render(<AudioSummaryPlayer {...props} />);

    expect(await screen.findByText(/briefing incomplete/i)).toBeInTheDocument();
  });
```

Replace the whole of "applies a stored rate only once, despite Strict Mode
double-invoking effects".

**Read this note before editing it — it records a real loss of coverage.** The
old assertion counted live utterances whose text started with the opening, and
it worked only because the opening was enqueued synchronously at mount, _before_
the stored rate was applied: a second `setRate` then re-spoke it and produced
two. With the introduction moved into the stream, every sentence now arrives
_after_ the rate has been restored, so a duplicated `setRate` cancels and
re-speaks a queue that is still empty. Since nothing is ever queued at the point
the rate is restored, the `restoredRate` ref that used to guard against a
redundant cancel had no observable effect any more, through the speech engine or
otherwise — so it was deleted. Do not attempt to preserve the old assertion; it
would pass with the guard deleted.

What replaces it is a weaker but honest invariant — under Strict Mode each
sentence still reaches the live queue exactly once — renamed so nobody reads it
as covering the rate guard:

```ts
  it("speaks each sentence exactly once under Strict Mode", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "1.5");
    const engine = installSpeechEngine();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...props} />
      </React.StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("1.5×")).toBeInTheDocument());
    await waitFor(() => expect(engine.spoken().length).toBeGreaterThanOrEqual(3));

    // Count only utterances queued after the last cancel: the fake's cancel()
    // does not discard queued utterances the way a real engine does, so
    // spoken() also contains ones that were cancelled before making a sound.
    const lastCancel = Math.max(0, ...engine.cancel.mock.invocationCallOrder);
    const live = engine.speak.mock.calls
      .filter(
        (_, index) => engine.speak.mock.invocationCallOrder[index] > lastCancel,
      )
      .map((call) => (call[0] as unknown as { text: string }).text);

    expect(live).toEqual([
      "Kernel 7.2 removes strncpy, from Hacker News, by Jane Doe.",
      "It landed after 362 patches.",
      "Maintainers had warned for years.",
    ]);
    expect(engine.spoken().at(-1)!.rate).toBe(1.5);
  });
```

Replace the whole of "still speaks the opening after Strict Mode's cleanup
cancels playback". Its premise survives — the remount branch must replay the
retained sentences after the cleanup's cancel — but the sentence it looks for
now arrives from the stream, so the assertion has to wait for it rather than
only for the cancel:

```ts
  it("still speaks the briefing after Strict Mode's cleanup cancels playback", async () => {
    const engine = installSpeechEngine();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...props} />
      </React.StrictMode>,
    );

    // The cleanup between Strict Mode's two mount passes cancels playback via
    // the hook's unmount effect. Without the remount branch's replay, playback
    // stays dead and nothing reaches the engine afterwards.
    //
    // Asserting on ordering rather than on spoken() is deliberate: the fake's
    // cancel() does not discard queued utterances the way a real engine does,
    // so spoken() alone cannot tell a live utterance from a cancelled one.
    await waitFor(() => expect(engine.spoken().length).toBeGreaterThanOrEqual(3));

    const lastCancel = Math.max(...engine.cancel.mock.invocationCallOrder);
    const spokenAfterCancel = engine.speak.mock.calls.some(
      (call, index) =>
        (call[0] as unknown as { text: string }).text.startsWith(
          "Kernel 7.2 removes strncpy",
        ) && engine.speak.mock.invocationCallOrder[index] > lastCancel,
    );
    expect(spokenAfterCancel).toBe(true);
  });
```

In "stops feeding the speech engine once the page unmounts", the inline mock's
chunks have no newlines, so under the new splitter nothing would ever be emitted
and the `waitFor` would time out. Give them newlines and drop the count by one,
since there is no longer a constructed opening ahead of them:

```ts
          async *[Symbol.asyncIterator]() {
            yield "First sentence here.\n";
            await gate;
            yield "Late sentence arrives.\n";
          },
```

```ts
    const { unmount } = render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(1));
```

Add the new alert test at the end of the describe block:

```ts
  it("warns when no voice matches the article's language", async () => {
    installSpeechEngine([{ name: "Test Voice", lang: "en-US" }]);

    render(<AudioSummaryPlayer articleId={42} language="de" />);

    expect(await screen.findByText(/no German voice/i)).toBeInTheDocument();
    // The reader can still play it, knowing it will be mispronounced.
    expect(screen.getByRole("button", { name: /pause|play/i })).toBeEnabled();
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project components` Expected: FAIL — the player still
builds an opening line and takes the old props.

- [ ] **Step 4: Update the player**

In `src/components/article/audio-summary-player.tsx`:

Replace the `buildOpeningLine` import with the splitter alone, and add the
display-name helper:

```ts
import { splitIntoSentences } from "@/lib/audio-script";
import { languageDisplayName } from "@/lib/language";
```

Replace the props interface:

```ts
interface AudioSummaryPlayerProps {
  articleId: number;
  language: string | null;
}
```

Take `voiceAvailable` from the hook and pass it the language:

```ts
const {
  activeIndex,
  enqueue,
  pause,
  paused,
  playFrom,
  rate,
  resume,
  setRate,
  speaking,
  supported,
  voiceAvailable,
} = useSpeechSynthesis(props.language);
```

In the streaming effect, delete the two lines that build and append the opening:

```ts
// The opening needs no generation, so playback starts before the model has
// returned anything — which also buys it a head start over the voice.
append(buildOpeningLine(props.title, props.author, props.feedTitle));
playFrom(0);
```

and replace them with:

```ts
// Marks playback active against an empty queue, so enqueue() hands each
// sentence straight to the engine as it streams in. The introduction is
// generated now, so nothing is audible until the first sentence lands.
playFrom(0);
```

Update that effect's dependency array, which no longer reads the removed props:

```ts
  }, [props.articleId, enqueue, playFrom]);
```

Add the new alert directly below the existing `!supported` one:

```tsx
{
  supported && !voiceAvailable && (
    <Alert>
      <AlertTitle>Voice unavailable</AlertTitle>
      <AlertDescription>
        No {languageDisplayName(props.language)} voice is installed in this
        browser, so the briefing will be read with the default voice and
        pronounced incorrectly. The transcript below is unaffected.
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 5: Update the page**

In `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`, replace
the player element:

```tsx
<AudioSummaryPlayer articleId={article.id} language={article.language} />
```

Leave the `articleAuthor` import and the
`<ArticleMeta author={articleAuthor(article)} />` above it alone — the page
still renders the author itself.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project components` Expected: PASS.

Run: `npx vitest run --project node tests/unit/audioSummaryPageLayout.test.ts`
Expected: PASS.

- [ ] **Step 7: Full verification**

Run: `npm run test` Expected: PASS, both projects.

Run: `npm run lint` Expected: no errors.

Run: `npm run build` Expected: build succeeds.

Run: `npm run format:check` Expected: clean. If not, run `npm run format` and
re-check.

- [ ] **Step 8: Commit**

```bash
git add src/components/article/audio-summary-player.tsx "src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx" tests/components/article/audio-summary-player.test.tsx tests/unit/audioSummaryPageLayout.test.ts
git commit -m "feat: warn when no voice is installed for a briefing's language"
```

---

## Manual verification

Automated tests mock every model call, so the prompts themselves are never
exercised against a real model. Before opening the PR, check the behaviour end
to end with a configured provider:

1. Add a German-language feed (for example
   `https://www.spiegel.de/schlagzeilen/tops/index.rss`) and let it refresh.
2. Confirm the card's lead is German, and that the article row in the database
   carries `language = 'de'`: `npx prisma studio` → Article → check `language`.
3. Open the text summary. The bullets **and** the `###` heading should be
   German.
4. Open the audio summary. The transcript should open with a German introduction
   naming the title and publication, each sentence on its own line, and — with a
   German voice installed — be spoken in German. Without one, the "Voice
   unavailable" alert should name German and playback should still be possible.
5. Open any English article and confirm nothing about it reads differently,
   other than the introduction now being generated rather than instant.

## Finishing up

Use the `superpowers:finishing-a-development-branch` skill. Per `AGENTS.md`:
push `feat/article-language`, open a PR against `main` with `gh pr create`, wait
for CI (`format-check`, `lint`, `test`, `build`), and leave the merge to the
user unless they explicitly ask for it.
