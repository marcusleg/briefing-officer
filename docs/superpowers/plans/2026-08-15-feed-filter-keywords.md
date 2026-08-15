# Feed Filter Keywords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text `Feed.interestProfile` with two per-feed keyword
lists — interests and disinterests — and turn the "not interested" button into
the entry point that writes into the disinterest list.

**Architecture:** Keywords live in a `FeedFilter` relation table
(`kind INTEREST | DISINTEREST`) rather than an array column, because Prisma's
SQLite connector has no scalar lists. Filtering stays where it is today — a
structured-output field on the lead generation call at ingest — but the prompt
now receives two lists and a four-clause arbitration rule instead of prose. The
`ArticleStatus.NOT_INTERESTED` state is removed; reader rejections become
`FILTERED` with a `filterReason`.

**Tech Stack:** Next.js App Router (server actions), Prisma 7 + SQLite, Zod 4,
`ai` SDK (`generateObject`), shadcn/ui + Radix, Vitest (node + jsdom projects),
Testing Library.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-15-feed-filter-keywords-design.md`.
- **Commits:** Conventional Commits, no scopes. `feat:`/`fix:` wording is
  user-facing — it goes in the changelog.
- **Never** use `git commit --no-verify`. The Husky hook runs `lint-staged`.
- **Branch:** work on `feat/feed-filter-keywords`, branched from `main`. Do not
  push to `main`.
- **Before pushing:** `npm run format`, `npm run lint`, `npm run typecheck`,
  `npm run test`, `npm run build` must all pass.
- **Prisma SQLite limits, both load-bearing here:** no `String[]` scalar lists,
  and `createMany` does **not** support `skipDuplicates`. Deduplicate in
  JavaScript before `createMany`, and use `upsert` for idempotent single
  inserts.
- **`"use server"` modules may only export async functions.** Constants and
  types must live in a non-`"use server"` module or the build fails.
- **Default disinterests** are exactly `["advertisements", "sponsored posts"]`,
  in that order.
- **Reader rejection reason** is exactly `"You marked this as not interested."`.

## Deviations from the spec, and why

Both are deliberate. Do not "fix" them back.

1. **Three migrations, not one.** The spec describes a single
   `replace_interest_profile_with_feed_filters`. Splitting it across Tasks 2, 4,
   and 6 is what lets each task leave the tree compiling and green. The end
   state is identical.
2. **`describeFilters` returns plain text, not emphasised text.** The spec's
   table renders entries in italics; that is Markdown emphasis in the spec
   document, not a UI requirement. A plain string keeps the function pure and
   unit-testable.

---

### Task 1: `describeFilters`

The plain-English sentence shown under the two fields in the feed form. Pure
function, no dependencies, so it goes first.

**Files:**

- Create: `src/lib/feedFilters.ts`
- Test: `tests/unit/feedFilters.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `describeFilters(interests: string[], disinterests: string[]): string`
  - `DEFAULT_DISINTERESTS: readonly string[]` —
    `["advertisements", "sponsored posts"]`
  - `dedupeKeywords(entries: string[]): string[]` — trims, drops empties,
    removes case-insensitive duplicates, preserves first-seen order.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/feedFilters.test.ts`:

```ts
import {
  DEFAULT_DISINTERESTS,
  dedupeKeywords,
  describeFilters,
} from "@/lib/feedFilters";
import { describe, expect, it } from "vitest";

describe("describeFilters", () => {
  it("reports that nothing is filtered when both lists are empty", () => {
    expect(describeFilters([], [])).toBe(
      "No filtering — every article from this feed is kept.",
    );
  });

  it("reads as an exclusion list when only disinterests are set", () => {
    expect(describeFilters([], ["advertisements", "sponsored posts"])).toBe(
      "Everything except advertisements, sponsored posts.",
    );
  });

  it("reads as a whitelist when only interests are set", () => {
    expect(describeFilters(["Linux Kernel Development"], [])).toBe(
      "Only Linux Kernel Development.",
    );
  });

  it("reads as a whitelist with carve-outs when both are set", () => {
    expect(
      describeFilters(["Linux Kernel Development"], ["USB driver development"]),
    ).toBe("Only Linux Kernel Development, except USB driver development.");
  });
});

describe("dedupeKeywords", () => {
  it("trims entries and drops empty ones", () => {
    expect(dedupeKeywords(["  spaced  ", "", "   "])).toEqual(["spaced"]);
  });

  it("removes case-insensitive duplicates, keeping the first spelling", () => {
    expect(dedupeKeywords(["Crypto", "crypto", "CRYPTO"])).toEqual(["Crypto"]);
  });

  it("preserves the order entries were given in", () => {
    expect(dedupeKeywords(["b", "a", "b"])).toEqual(["b", "a"]);
  });
});

describe("DEFAULT_DISINTERESTS", () => {
  it("is advertisements and sponsored posts, in that order", () => {
    expect([...DEFAULT_DISINTERESTS]).toEqual([
      "advertisements",
      "sponsored posts",
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/unit/feedFilters.test.ts`

Expected: FAIL — `Failed to resolve import "@/lib/feedFilters"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/feedFilters.ts`:

```ts
/**
 * Seeded into every new feed's disinterest list. Written as data rather than
 * enforced in code so the reader can delete them — a default that cannot be
 * removed is a policy, and this one is only a good guess.
 */
export const DEFAULT_DISINTERESTS = [
  "advertisements",
  "sponsored posts",
] as const;

/**
 * Entries arrive from three places — seeded defaults, the "not interested"
 * popover, and the feed form — so duplicates are a matter of time. The
 * database's unique constraint is the backstop; this is the pass that lets
 * `createMany` be used at all, since Prisma's SQLite connector does not
 * support `skipDuplicates`.
 *
 * Comparison is case-insensitive but the first spelling is what gets stored:
 * the reader typed it that way, and the model reads it either way.
 */
export const dedupeKeywords = (entries: string[]): string[] => {
  const seen = new Set<string>();

  return entries.reduce<string[]>((kept, entry) => {
    const text = entry.trim();
    const key = text.toLowerCase();

    if (text === "" || seen.has(key)) {
      return kept;
    }

    seen.add(key);
    return [...kept, text];
  }, []);
};

/**
 * The two lists in one sentence, shown under the fields that produce them.
 *
 * It exists because the mode is derived rather than selected: adding a first
 * interest entry silently narrows the feed from everything to only that, which
 * is the one sharp edge in having no mode control. A sentence the reader reads
 * before saving turns that from a surprise into a choice.
 */
export const describeFilters = (
  interests: string[],
  disinterests: string[],
): string => {
  if (interests.length === 0 && disinterests.length === 0) {
    return "No filtering — every article from this feed is kept.";
  }

  if (interests.length === 0) {
    return `Everything except ${disinterests.join(", ")}.`;
  }

  if (disinterests.length === 0) {
    return `Only ${interests.join(", ")}.`;
  }

  return `Only ${interests.join(", ")}, except ${disinterests.join(", ")}.`;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project node tests/unit/feedFilters.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedFilters.ts tests/unit/feedFilters.test.ts
git commit -m "feat: describe a feed's keyword filters in plain English"
```

---

### Task 2: The `FeedFilter` model

Additive only. `Feed.interestProfile` stays until Task 4, so nothing breaks.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>_add_feed_filters/migration.sql`
  (generated)
- Modify: `tests/helpers/db.ts`
- Modify: `tests/helpers/factories.ts`
- Test: `tests/integration/feedFilters.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - Prisma model `FeedFilter { id, feedId, feed, kind, text, createdAt }` with
    `@@unique([feedId, kind, text])`
  - Prisma enum `FeedFilterKind { INTEREST, DISINTEREST }`
  - `Feed.filters: FeedFilter[]`
  - Test factory `createFeedFilter({ feedId, kind, text }): Promise<FeedFilter>`

- [ ] **Step 1: Add the model to the schema**

In `prisma/schema.prisma`, add below the `ArticleStatus` enum:

```prisma
enum FeedFilterKind {
  INTEREST
  DISINTEREST
}
```

Add a new model after `FeedCategory`:

```prisma
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

Add the back-relation to `Feed`, directly under the `articles` line:

```prisma
filters         FeedFilter[]
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_feed_filters`

Expected: a new folder under `prisma/migrations/` containing
`CREATE TABLE "FeedFilter"` and a
`CREATE UNIQUE INDEX "FeedFilter_feedId_kind_text_key"`, and the Prisma client
regenerates into `src/generated/prisma`.

- [ ] **Step 3: Teach the test database reset about the new table**

In `tests/helpers/db.ts`, add the delete **before** `prisma.feed.deleteMany()`
(children before parents):

```ts
await prisma.article.deleteMany();
await prisma.feedFilter.deleteMany();
await prisma.feed.deleteMany();
```

- [ ] **Step 4: Write the failing test**

Create `tests/integration/feedFilters.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it } from "vitest";
import { createFeed, createFeedFilter, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("FeedFilter", () => {
  it("rejects a duplicate entry for the same feed and kind", async () => {
    await createFeedFilter({ feedId, kind: "DISINTEREST", text: "crypto" });

    await expect(
      createFeedFilter({ feedId, kind: "DISINTEREST", text: "crypto" }),
    ).rejects.toThrow();
  });

  it("allows the same text in both lists", async () => {
    await createFeedFilter({ feedId, kind: "DISINTEREST", text: "politics" });

    await expect(
      createFeedFilter({ feedId, kind: "INTEREST", text: "politics" }),
    ).resolves.toBeTruthy();
  });

  it("deletes a feed's filters along with the feed", async () => {
    await createFeedFilter({ feedId, kind: "INTEREST", text: "kernel" });

    await prisma.feed.delete({ where: { id: feedId } });

    expect(await prisma.feedFilter.count({ where: { feedId } })).toBe(0);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run --project node tests/integration/feedFilters.test.ts`

Expected: FAIL — `createFeedFilter is not a function`.

- [ ] **Step 6: Add the factory**

In `tests/helpers/factories.ts`, change the first import to include the new
enum:

```ts
import { ArticleStatus, FeedFilterKind } from "@/generated/prisma/client";
```

and append:

```ts
export const createFeedFilter = (overrides: {
  feedId: number;
  kind: FeedFilterKind;
  text: string;
}) => {
  return prisma.feedFilter.create({
    data: {
      feedId: overrides.feedId,
      kind: overrides.kind,
      text: overrides.text,
    },
  });
};
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run --project node tests/integration/feedFilters.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma \
  tests/helpers/db.ts tests/helpers/factories.ts \
  tests/integration/feedFilters.test.ts
git commit -m "feat: store per-feed interest and disinterest keywords"
```

---

### Task 3: Two-list filtering prompt

Changes `buildLeadPrompt`'s third parameter into two arrays and rewrites the
relevance directive around the four arbitration clauses. `leadService` moves
over in the same task because the signature change breaks its only call site.

**Files:**

- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/ai/services/leadService.ts`
- Test: `tests/unit/prompts.test.ts`
- Test: `tests/integration/leadService.test.ts`

**Interfaces:**

- Consumes: `FeedFilterKind` and `Feed.filters` from Task 2.
- Produces:
  - `buildLeadPrompt(title: string, textContent: string, interests: string[], disinterests: string[]): string`

- [ ] **Step 1: Rewrite the prompt tests**

In `tests/unit/prompts.test.ts`, replace the whole `describe("buildLeadPrompt")`
block with:

```ts
describe("buildLeadPrompt", () => {
  it("includes the title and the article text", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here", [], []);
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("Body text here");
    expect(prompt).toContain("no longer than 80 words");
  });

  it("asks the model to report the language as an ISO 639-1 code", () => {
    // The lead is the one call that determines the language; everything
    // downstream reads what it stored.
    const prompt = buildLeadPrompt("My Title", "Body text here", [], []);
    expect(prompt).toContain("ISO 639-1");
    expect(prompt).toContain('"und"');
  });

  it("asks for the lead in the language it reports", () => {
    const prompt = buildLeadPrompt("My Title", "Body text here", [], []);
    expect(prompt).toContain("in the language you reported");
  });

  it("leaves the lead prompt unchanged when both lists are empty", () => {
    const prompt = buildLeadPrompt("Title", "Body", [], []);

    expect(prompt).not.toContain("reader_interests");
    expect(prompt).not.toContain("reader_disinterests");
    expect(prompt).not.toContain("excludeArticle");
    expect(prompt).toContain("no longer than 80 words");
  });

  it("renders only the list that has entries", () => {
    const prompt = buildLeadPrompt("Title", "Body", [], ["press releases"]);

    expect(prompt).toContain("<reader_disinterests>");
    expect(prompt).toContain("- press releases");
    expect(prompt).not.toContain("<reader_interests>");
  });

  it("renders both lists when both have entries", () => {
    const prompt = buildLeadPrompt(
      "Title",
      "Body",
      ["Linux kernel development"],
      ["USB driver development"],
    );

    expect(prompt).toContain("- Linux kernel development");
    expect(prompt).toContain("- USB driver development");
    expect(prompt).toContain("excludeArticle");
  });

  // Specificity, not list precedence, is what settles a conflict. Both of the
  // examples that motivated the rule pull in opposite directions under any
  // fixed precedence, so this instruction is the whole design in one sentence
  // and a reword must not lose it.
  it("tells the model that the narrower entry wins, whichever list it is in", () => {
    const prompt = buildLeadPrompt(
      "Title",
      "Body",
      ["politics"],
      ["sport"],
    ).replace(/\s+/g, " ");

    expect(prompt).toContain(
      "the narrower entry decides — whichever list it is in",
    );
  });

  it("keeps an unmatched article when the interest list is empty", () => {
    const prompt = buildLeadPrompt("Title", "Body", [], ["sport"]).replace(
      /\s+/g,
      " ",
    );

    expect(prompt).toContain("If neither list speaks to this article, keep it");
    expect(prompt).not.toContain(
      "exclude it — the reader named what they want",
    );
  });

  it("excludes an unmatched article when the interest list is not empty", () => {
    const prompt = buildLeadPrompt("Title", "Body", ["kernel"], []).replace(
      /\s+/g,
      " ",
    );

    expect(prompt).toContain(
      "If neither list speaks to this article, exclude it",
    );
    expect(prompt).not.toContain(
      "If neither list speaks to this article, keep it",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project node tests/unit/prompts.test.ts`

Expected: FAIL — the new list assertions fail because the third argument is
still treated as a string.

- [ ] **Step 3: Rewrite the relevance directive**

In `src/lib/ai/prompts.ts`, replace the entire `relevanceDirective` constant
(including its doc comment) and the `buildLeadPrompt` export with:

```ts
const filterList = (name: string, entries: string[]) =>
  entries.length === 0
    ? ""
    : `
<reader_${name}>
${entries.map((entry) => `- ${entry}`).join("\n")}
</reader_${name}>
`;

/**
 * Appended only when the feed has at least one keyword, so a feed with neither
 * list produces exactly the prompt it produced before filtering existed.
 *
 * The lists are rendered as structure rather than prose because the free-text
 * profile this replaced had to be read for its polarity first: "everything
 * except X" and "only X" lived in the same field and were told apart by
 * wording, which a model got backwards. Two named lists cannot be misread for
 * each other.
 *
 * Clause 2 is the load-bearing one. A reader may write a broad interest with a
 * narrow exception ("kernel development" but not "USB drivers") or a broad
 * disinterest with a narrow exception ("politics" but yes to "politics in the
 * Faroe Islands"). No fixed precedence between the lists satisfies both;
 * specificity satisfies both.
 *
 * Clause 4 is the only thing that produces "only…" behaviour. There is no mode
 * flag anywhere — a non-empty interest list is the mode.
 */
const relevanceDirective = (interests: string[], disinterests: string[]) => {
  if (interests.length === 0 && disinterests.length === 0) {
    return "";
  }

  // Only the applicable sentence is rendered, so the model is never reasoning
  // about a branch that cannot fire.
  const unmatched =
    interests.length === 0
      ? "If neither list speaks to this article, keep it."
      : "If neither list speaks to this article, exclude it — the reader named what they want, and this is not it.";

  return `

The reader has named topics they want from this feed and topics they do not.
${filterList("interests", interests)}${filterList("disinterests", disinterests)}
Your decision is whether to exclude this article from the reader's inbox. Apply
these rules in order:

1. If only one list speaks to this article, that list decides.
2. If both lists speak to it and one entry is a narrower case of the other, the
   narrower entry decides — whichever list it is in. "USB driver development"
   is narrower than "Linux kernel development"; "politics in the Faroe Islands"
   is narrower than "politics".
3. If both lists speak to it independently, neither entry refining the other,
   exclude it.
4. ${unmatched}

Judge what the article is about, not which words appear in it. An article that
merely mentions a named topic in passing is not about it.

Report one sentence of reasoning as \`exclusionReason\`, naming the entry you
applied, then your decision as \`excludeArticle\`. Write the reasoning in the
same language as the lead.`;
};

export const buildLeadPrompt = (
  title: string,
  textContent: string,
  interests: string[],
  disinterests: string[],
) =>
  `Write a single paragraph summarizing what the article covers and why it is significant or timely. Be factual and objective. The summary must be no longer than 80 words. Do not copy the article's opening lines verbatim, and do not add introductory phrases, headings, or filler.

First determine the language the article is written in and report it as a two-letter ISO 639-1 code, for example "de" for German. If the language cannot be established, report "und". Write the lead in the language you reported.${relevanceDirective(interests, disinterests)}

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;
```

- [ ] **Step 4: Run the prompt tests to verify they pass**

Run: `npx vitest run --project node tests/unit/prompts.test.ts`

Expected: PASS.

- [ ] **Step 5: Point `leadService` at the filter rows**

In `src/lib/ai/services/leadService.ts`, replace the opening of `generateAiLead`
— from the `findUniqueOrThrow` call through the `buildLeadPrompt` call — with:

```ts
const article = await prisma.article.findUniqueOrThrow({
  include: { feed: { include: { filters: true } }, scrape: true },
  where: { id: articleId },
});

const keywordsOfKind = (kind: FeedFilterKind) =>
  article.feed.filters
    .filter((filter) => filter.kind === kind)
    .map((filter) => filter.text);

const interests = keywordsOfKind("INTEREST");
const disinterests = keywordsOfKind("DISINTEREST");

const filtering = interests.length > 0 || disinterests.length > 0;
const prompt = buildLeadPrompt(
  article.title,
  article.scrape?.textContent ?? "",
  interests,
  disinterests,
);
```

Add the enum to the imports at the top of the file:

```ts
import { FeedFilterKind } from "@/generated/prisma/client";
```

- [ ] **Step 6: Update the lead service tests**

`tests/integration/leadService.test.ts` sets filtering up in five places (around
lines 146, 164, 184, 199, 224) with the expression
`(await createFeed({ userId, interestProfile: "Only databases" })).id`.

Extend the factory import:

```ts
import {
  createArticle,
  createFeed,
  createFeedFilter,
  createUser,
} from "../helpers/factories";
```

Add this helper next to the existing `mockVerdict` helper near the top of the
file:

```ts
import { FeedFilterKind } from "@/generated/prisma/client";

const feedWithKeyword = async (kind: FeedFilterKind, text: string) => {
  const feed = await createFeed({ userId });
  await createFeedFilter({ feedId: feed.id, kind, text });
  return feed.id;
};
```

Then replace every
`(await createFeed({ userId, interestProfile: "Only databases" })).id` with:

```ts
await feedWithKeyword("INTEREST", "databases");
```

The one remaining `interestProfile` at roughly line 224 holds a longer profile
string; replace that `createFeed` call the same way, choosing the keyword that
matches what the test is asserting about.

Add a test that the non-filtering path is still taken when no keywords exist:

```ts
it("does not ask for a verdict when the feed has no keywords", async () => {
  const article = await createArticle({ userId, feedId });
  mockGeneration("en");

  await generateAiLead(article.id);

  const [call] = vi.mocked(generateObject).mock.calls;
  expect(Object.keys((call[0] as any).schema.shape)).toEqual([
    "language",
    "lead",
  ]);
});
```

- [ ] **Step 7: Run the full node suite**

Run: `npx vitest run --project node`

Expected: PASS. If a lead service test still references `interestProfile`, fix
it now — the column is not removed until Task 4, so this is a test-only fix.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/services/leadService.ts \
  tests/unit/prompts.test.ts tests/integration/leadService.test.ts
git commit -m "feat: filter articles against separate interest and disinterest keywords"
```

---

### Task 4: Persist the lists, and drop `interestProfile`

**Files:**

- Modify: `src/lib/repository/feedSchema.ts`
- Modify: `src/lib/repository/feedRepository.ts`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `tests/helpers/factories.ts`
- Create:
  `prisma/migrations/<generated>_drop_feed_interest_profile/migration.sql`
  (generated)
- Test: `tests/unit/feedSchema.test.ts`
- Test: `tests/integration/feedRepository.test.ts`

**Interfaces:**

- Consumes: `dedupeKeywords`, `DEFAULT_DISINTERESTS` (Task 1); `FeedFilter`
  (Task 2).
- Produces:
  - `FeedSchema` with `interests: string[]` and `disinterests: string[]`
  - `createFeed(feed: FeedSchema)` — writes filters, merging
    `DEFAULT_DISINTERESTS` into the disinterest list
  - `updateFeed(feedId: number, feed: FeedSchema)` — replaces the filter set,
    seeding nothing
  - `getFeedFilters(feedId: number): Promise<{ interests: string[]; disinterests: string[] }>`

- [ ] **Step 1: Write the failing schema test**

In `tests/unit/feedSchema.test.ts`, add:

```ts
describe("feedSchema keyword lists", () => {
  const base = {
    title: "T",
    link: "https://example.com/feed.xml",
    autoRefresh: true,
  };

  it("defaults both lists to empty", () => {
    const parsed = feedSchema.parse(base);

    expect(parsed.interests).toEqual([]);
    expect(parsed.disinterests).toEqual([]);
  });

  it("trims entries", () => {
    const parsed = feedSchema.parse({ ...base, interests: ["  kernel  "] });

    expect(parsed.interests).toEqual(["kernel"]);
  });

  it("rejects an entry that is empty once trimmed", () => {
    expect(() => feedSchema.parse({ ...base, interests: ["   "] })).toThrow();
  });

  it("keeps entries containing spaces intact", () => {
    const parsed = feedSchema.parse({
      ...base,
      disinterests: ["long form opinion pieces about football"],
    });

    expect(parsed.disinterests).toEqual([
      "long form opinion pieces about football",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project node tests/unit/feedSchema.test.ts`

Expected: FAIL — `parsed.interests` is `undefined`.

- [ ] **Step 3: Update the Zod schema**

In `src/lib/repository/feedSchema.ts`, replace the `interestProfile` line in
`feedSchema` with:

```ts
  interests: z.array(z.string().trim().min(1)).default([]),
  disinterests: z.array(z.string().trim().min(1)).default([]),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --project node tests/unit/feedSchema.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing repository test**

In `tests/integration/feedRepository.test.ts`, first fix the two existing tests
that pass `interestProfile` to the actions — `createFeedAction` at roughly line
152 and `updateFeed` at roughly line 171. In both, replace the
`interestProfile: "",` line with:

```ts
      interests: [],
      disinterests: [],
```

Add `createFeedFilter` to the factory import at the top of the file, then append
these tests:

```ts
describe("feed keyword filters", () => {
  it("seeds the default disinterests when creating a feed", async () => {
    // Mirrors the fetch stub in "feedRepository.createFeed" above: createFeed
    // fetches and parses the feed URL before it writes anything.
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml)),
    );
    vi.mocked(scrapeFeed).mockResolvedValue([]);

    await createFeedAction({
      title: "",
      link: "https://example.com/seeded.xml",
      interests: [],
      disinterests: [],
      autoRefresh: true,
    });

    const feed = await prisma.feed.findFirstOrThrow({
      where: { userId },
      include: { filters: true },
    });

    expect(
      feed.filters
        .filter((filter) => filter.kind === "DISINTEREST")
        .map((filter) => filter.text),
    ).toEqual(["advertisements", "sponsored posts"]);

    vi.unstubAllGlobals();
  });

  it("replaces the whole filter set on update", async () => {
    const userId = (await createUser()).id;
    const feed = await createFeed({ userId });
    await createFeedFilter({
      feedId: feed.id,
      kind: "INTEREST",
      text: "gone after update",
    });

    await updateFeed(feed.id, {
      title: feed.title,
      link: feed.link,
      autoRefresh: feed.autoRefresh,
      interests: ["kernel"],
      disinterests: ["usb"],
    });

    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
      orderBy: { text: "asc" },
    });

    expect(filters.map((filter) => `${filter.kind}:${filter.text}`)).toEqual([
      "INTEREST:kernel",
      "DISINTEREST:usb",
    ]);
  });

  it("does not re-seed the defaults on update", async () => {
    const userId = (await createUser()).id;
    const feed = await createFeed({ userId });

    await updateFeed(feed.id, {
      title: feed.title,
      link: feed.link,
      autoRefresh: feed.autoRefresh,
      interests: [],
      disinterests: [],
    });

    expect(await prisma.feedFilter.count({ where: { feedId: feed.id } })).toBe(
      0,
    );
  });
});
```

Note: the second assertion above expects `orderBy: { text: "asc" }` to yield
`kernel` before `usb`, which it does. Adjust the expected array if you order
differently.

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run --project node tests/integration/feedRepository.test.ts`

Expected: FAIL — `updateFeed` rejects the unknown `interests` property, or the
filters table is empty.

- [ ] **Step 7: Write the repository implementation**

In `src/lib/repository/feedRepository.ts`, add to the imports:

```ts
import { FeedFilterKind, Prisma } from "@/generated/prisma/client";
import { DEFAULT_DISINTERESTS, dedupeKeywords } from "@/lib/feedFilters";
```

Add this helper above `createFeed`:

```ts
/**
 * Deduplicated in JavaScript rather than with `createMany({ skipDuplicates })`,
 * which Prisma's SQLite connector does not support. The database's unique
 * constraint remains the backstop.
 */
const filterRows = (
  feedId: number,
  interests: string[],
  disinterests: string[],
) => [
  ...dedupeKeywords(interests).map((text) => ({
    feedId,
    kind: "INTEREST" as FeedFilterKind,
    text,
  })),
  ...dedupeKeywords(disinterests).map((text) => ({
    feedId,
    kind: "DISINTEREST" as FeedFilterKind,
    text,
  })),
];
```

Replace the `prisma.feed.create` call inside `createFeed` with:

```ts
const createdFeed = await prisma.feed.create({
  data: {
    title: feed.title || parsedFeed.title,
    link: feed.link,
    autoRefresh: feed.autoRefresh,
    feedCategoryId: feed.feedCategoryId ?? null,
    lastFetched: new Date(0),
    userId: userId,
  },
});

// Seeded only on create. An update that arrives with an empty disinterest
// list means the reader removed the defaults, and re-adding them here would
// make them unremovable.
await prisma.feedFilter.createMany({
  data: filterRows(createdFeed.id, feed.interests, [
    ...feed.disinterests,
    ...DEFAULT_DISINTERESTS,
  ]),
});
```

Replace the body of `updateFeed` with:

```ts
export const updateFeed = async (feedId: number, feed: FeedSchema) => {
  const userId = await getUserId();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.feed.update({
      where: { id: feedId, userId },
      data: {
        title: feed.title,
        link: feed.link,
        autoRefresh: feed.autoRefresh,
        feedCategoryId: feed.feedCategoryId ?? null,
      },
    });

    await tx.feedFilter.deleteMany({ where: { feedId } });
    await tx.feedFilter.createMany({
      data: filterRows(feedId, feed.interests, feed.disinterests),
    });
  });

  revalidatePath("/feed", "layout");

  await refreshFeed(feedId);
};
```

Add a reader for the form, at the end of the file:

```ts
export const getFeedFilters = async (feedId: number) => {
  const filters = await prisma.feedFilter.findMany({
    where: { feedId },
    orderBy: { createdAt: "asc" },
  });

  const textsOfKind = (kind: FeedFilterKind) =>
    filters.filter((filter) => filter.kind === kind).map((f) => f.text);

  return {
    interests: textsOfKind("INTEREST"),
    disinterests: textsOfKind("DISINTEREST"),
  };
};
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run --project node tests/integration/feedRepository.test.ts`

Expected: PASS.

- [ ] **Step 9: Drop the column**

Remove this line from `model Feed` in `prisma/schema.prisma`:

```prisma
interestProfile String        @default("")
```

Remove `interestProfile` from the `createFeed` factory in
`tests/helpers/factories.ts` — both the optional property in the overrides type
and the `interestProfile: overrides.interestProfile ?? "",` line.

In `prisma/seed.ts`, find every `interestProfile:` in feed creation and replace
it with a `filters: { create: [...] }` block, for example:

```ts
      filters: {
        create: [
          { kind: "DISINTEREST", text: "advertisements" },
          { kind: "DISINTEREST", text: "sponsored posts" },
        ],
      },
```

Then run: `npx prisma migrate dev --name drop_feed_interest_profile`

Expected: a migration that rebuilds the `Feed` table without the column. SQLite
has no `DROP COLUMN` in older versions, so Prisma may emit a create-copy-drop-
rename sequence. That is expected.

- [ ] **Step 10: Verify the whole suite and the types**

Run: `npm run typecheck && npx vitest run --project node`

Expected: PASS. Any remaining `interestProfile` reference is a compile error;
`grep -rn "interestProfile" src tests prisma` should return nothing.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: replace the free-text interest profile with keyword lists"
```

---

### Task 5: Keyword input and feed form

**Files:**

- Create: `src/components/feed/keyword-list-field.tsx`
- Modify: `src/components/feed/feed-form.tsx`
- Test: `tests/components/feed/keyword-list-field.test.tsx`

**Interfaces:**

- Consumes: `describeFilters` (Task 1); `FeedSchema`, `getFeedFilters` (Task 4).
- Produces:
  - `KeywordListField` with props
    `{ value: string[]; onChange: (next: string[]) => void; disabled?: boolean; placeholder?: string; inputLabel: string }`

- [ ] **Step 1: Write the failing component test**

Create `tests/components/feed/keyword-list-field.test.tsx`:

```tsx
import KeywordListField from "@/components/feed/keyword-list-field";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const setup = (value: string[] = []) => {
  const onChange = vi.fn();
  render(
    <KeywordListField
      value={value}
      onChange={onChange}
      inputLabel="Add a keyword"
    />,
  );
  return { onChange };
};

describe("KeywordListField", () => {
  it("adds the typed entry when Enter is pressed", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "USB driver development{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith(["USB driver development"]);
  });

  it("keeps spaces, so a whole sentence can be entered", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "anything that reads like a press release{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith([
      "anything that reads like a press release",
    ]);
  });

  it("trims the entry", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "  x  {Enter}",
    );

    expect(onChange).toHaveBeenCalledWith(["x"]);
  });

  it("ignores an entry that is empty once trimmed", async () => {
    const { onChange } = setup();

    await userEvent.type(screen.getByLabelText("Add a keyword"), "   {Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a case-insensitive duplicate", async () => {
    const { onChange } = setup(["Crypto"]);

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "crypto{Enter}",
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes an entry when its remove button is clicked", async () => {
    const { onChange } = setup(["kernel", "usb"]);

    await userEvent.click(screen.getByRole("button", { name: "Remove usb" }));

    expect(onChange).toHaveBeenCalledWith(["kernel"]);
  });

  it("clears the input after adding", async () => {
    setup();
    const input = screen.getByLabelText("Add a keyword");

    await userEvent.type(input, "kernel{Enter}");

    expect((input as HTMLInputElement).value).toBe("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
`npx vitest run --project components tests/components/feed/keyword-list-field.test.tsx`

Expected: FAIL — cannot resolve `@/components/feed/keyword-list-field`.

- [ ] **Step 3: Write the component**

Create `src/components/feed/keyword-list-field.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon } from "lucide-react";
import { useState } from "react";

interface KeywordListFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Accessible name for the text input; each instance needs its own. */
  inputLabel: string;
}

const KeywordListField = ({
  value,
  onChange,
  disabled,
  placeholder,
  inputLabel,
}: KeywordListFieldProps) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();

    if (text === "") {
      return;
    }

    // Silently ignored rather than flagged: re-adding something already in the
    // list is a no-op the reader intended, not a mistake worth an error.
    const duplicate = value.some(
      (entry) => entry.toLowerCase() === text.toLowerCase(),
    );

    if (!duplicate) {
      onChange([...value, text]);
    }

    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((entry) => (
            <Badge key={entry} variant="secondary" className="gap-1 pr-1">
              {entry}
              <button
                type="button"
                aria-label={`Remove ${entry}`}
                disabled={disabled}
                onClick={() =>
                  onChange(value.filter((current) => current !== entry))
                }
                className="cursor-pointer"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          aria-label={inputLabel}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Without this the Enter key submits the surrounding form instead
            // of adding the entry.
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          value={draft}
        />
        <Button
          className="cursor-pointer"
          disabled={disabled}
          onClick={add}
          type="button"
          variant="secondary"
        >
          Add
        </Button>
      </div>
    </div>
  );
};

export default KeywordListField;
```

- [ ] **Step 4: Run it to verify it passes**

Run:
`npx vitest run --project components tests/components/feed/keyword-list-field.test.tsx`

Expected: PASS, 7 tests.

- [ ] **Step 5: Wire the feed form**

In `src/components/feed/feed-form.tsx`:

Replace the `Textarea` import with:

```tsx
import KeywordListField from "@/components/feed/keyword-list-field";
import { describeFilters } from "@/lib/feedFilters";
```

Replace `interestProfile` in both `defaultValues` branches:

```tsx
    defaultValues: editFeed
      ? {
          title: editFeed.title,
          link: editFeed.link,
          interests: [],
          disinterests: [],
          feedCategoryId: editFeed.feedCategoryId ?? undefined,
          autoRefresh: editFeed.autoRefresh,
        }
      : {
          title: "",
          link: "",
          interests: [],
          disinterests: [],
          feedCategoryId: undefined,
          autoRefresh: true,
        },
```

Load an existing feed's lists alongside the categories, adding to the existing
`useEffect` block:

```tsx
useEffect(() => {
  if (!editFeed) {
    return;
  }

  getFeedFilters(editFeed.id).then(({ interests, disinterests }) => {
    form.setValue("interests", interests);
    form.setValue("disinterests", disinterests);
  });
}, [editFeed, form]);
```

and add `getFeedFilters` to the existing import from
`@/lib/repository/feedRepository`.

Replace the whole `interestProfile` `FormField` with:

```tsx
          <FormField
            control={form.control}
            name="interests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interested in</FormLabel>
                <FormControl>
                  <KeywordListField
                    disabled={submitting}
                    inputLabel="Add an interest"
                    onChange={field.onChange}
                    placeholder="Linux kernel development"
                    value={field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="disinterests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Not interested in</FormLabel>
                <FormControl>
                  <KeywordListField
                    disabled={submitting}
                    inputLabel="Add a disinterest"
                    onChange={field.onChange}
                    placeholder="USB driver development"
                    value={field.value}
                  />
                </FormControl>
                <FormDescription>
                  {describeFilters(
                    form.watch("interests"),
                    form.watch("disinterests"),
                  )}{" "}
                  When both lists speak to an article, the more specific entry
                  wins.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
```

- [ ] **Step 6: Verify types and formatting**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/feed/keyword-list-field.tsx \
  src/components/feed/feed-form.tsx \
  tests/components/feed/keyword-list-field.test.tsx
git commit -m "feat: manage feed keywords as two editable lists"
```

---

### Task 6: Remove `ArticleStatus.NOT_INTERESTED`

Reader rejections become `FILTERED` carrying a reason. Independent of the
keyword work except that Task 8 depends on it.

**Files:**

- Modify: `prisma/schema.prisma`
- Create:
  `prisma/migrations/<generated>_drop_not_interested_status/migration.sql`
  (hand-edited)
- Modify: `src/lib/article.ts`
- Modify: `src/lib/repository/articleRepository.ts`
- Modify: `src/lib/repository/statsTransforms.ts`
- Modify: `src/lib/repository/statsRepository.ts`
- Modify: `src/app/feed/daily-filtered-articles-chart.tsx`
- Modify: `src/app/feed/filtered/page.tsx:27`
- Modify: `src/app/feed/[feedId]/page.tsx:47`
- Modify: `src/components/article/article-card.tsx:145-152`
- Modify: `src/components/article/article-card-actions.tsx:47`
- Modify: `prisma/seed.ts:307`
- Test: `tests/unit/article.test.ts`, `tests/unit/statsTransforms.test.ts`,
  `tests/integration/articleRepository.test.ts`,
  `tests/integration/statsRepository.test.ts`,
  `tests/components/article/dismiss-button.test.tsx`,
  `tests/components/article/article-card-actions.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `READER_FILTER_REASON: string` exported from `src/lib/article.ts`
  - `markArticleAsNotInteresting(articleId: number)` — sets `FILTERED` and the
    reason
  - `RejectedArticlesRow = { date: string; filtered: number }`

- [ ] **Step 1: Write the failing repository test**

In `tests/integration/articleRepository.test.ts`, replace the existing assertion
that `markArticleAsNotInteresting` produces `NOT_INTERESTED` with:

```ts
it("files a reader rejection as FILTERED with a reason", async () => {
  const article = await createArticle({ userId, feedId });

  await markArticleAsNotInteresting(article.id);

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: article.id },
  });

  expect(updated.status).toBe("FILTERED");
  expect(updated.filterReason).toBe("You marked this as not interested.");
});
```

Also change every `it.each(["READ", "FILTERED", "NOT_INTERESTED"] as const)` in
this file to `it.each(["READ", "FILTERED"] as const)`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project node tests/integration/articleRepository.test.ts`

Expected: FAIL — status is `NOT_INTERESTED`, `filterReason` is null.

- [ ] **Step 3: Add the reason constant**

In `src/lib/article.ts`, append:

```ts
/**
 * Written to `filterReason` when the reader rejects an article by hand.
 *
 * It lives here rather than in `articleRepository.ts` because that module is
 * `"use server"`, and a server-action module may only export async functions.
 */
export const READER_FILTER_REASON = "You marked this as not interested.";
```

and correct the `isInInbox` doc comment, which names the terminal states:

```ts
 * `READ_LATER` belongs here alongside `UNREAD`: saving an article for later
 * does not remove it from the reader's queue, it just defers it. `READ` and
 * `FILTERED` are the states an article leaves the inbox for.
```

- [ ] **Step 4: Let the status chokepoint carry a reason**

In `src/lib/repository/articleRepository.ts`, replace `setArticleStatus` with:

```ts
/**
 * The only writers of `status` and `statusChangedAt`. Pairing the two writes
 * here is what lets History treat `statusChangedAt` as the read timestamp: for
 * a READ article it is, by construction, the moment it became read. Anything
 * that writes one without the other breaks that.
 *
 * `filterReason` is optional and only ever set alongside `FILTERED`. It is
 * accepted here rather than written separately so a rejection cannot land as a
 * status without its explanation.
 */
const setArticleStatus = (
  articleId: number,
  status: ArticleStatus,
  filterReason?: string,
) =>
  prisma.article.update({
    where: { id: articleId },
    data: {
      status,
      statusChangedAt: new Date(),
      ...(filterReason === undefined ? {} : { filterReason }),
    },
  });
```

and replace `markArticleAsNotInteresting` with:

```ts
export const markArticleAsNotInteresting = async (articleId: number) => {
  const updatedArticle = await setArticleStatus(
    articleId,
    "FILTERED",
    READER_FILTER_REASON,
  );

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/feed");
  revalidatePath("/feed", "layout");
};
```

Add to the imports:

```ts
import { READER_FILTER_REASON } from "@/lib/article";
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run --project node tests/integration/articleRepository.test.ts`

Expected: PASS.

- [ ] **Step 6: Collapse the stats to one series**

In `src/lib/repository/statsTransforms.ts`, replace `RejectedArticlesRow` and
`shapeRejectedArticlesPerDay` with:

```ts
export interface RejectedArticlesRow {
  date: string;
  filtered: number;
}

/**
 * Counts rejected articles per day.
 *
 * This used to split model verdicts from reader rejections, which is what made
 * the filter's precision readable off the chart. With one terminal state there
 * is nothing to split on. `FeedFilter.createdAt` — keywords added per day — is
 * the natural replacement and is deliberately not implemented here.
 *
 * There is one row per day in `dates`, so quiet days render as a gap rather
 * than being skipped. Days are the UTC calendar days used everywhere else in
 * the stats layer.
 */
export function shapeRejectedArticlesPerDay(
  dates: string[],
  articles: Array<{ status: ArticleStatus; statusChangedAt: Date }>,
): RejectedArticlesRow[] {
  const rows = new Map(dates.map((date) => [date, { date, filtered: 0 }]));

  articles.forEach((article) => {
    const row = rows.get(article.statusChangedAt.toISOString().split("T")[0]);

    if (row && article.status === "FILTERED") {
      row.filtered += 1;
    }
  });

  return dates.map((date) => rows.get(date) ?? { date, filtered: 0 });
}
```

In `src/lib/repository/statsRepository.ts`, update the doc comment and the two
code references:

```ts
/**
 * Articles that never made it to the reader, per day — whether the model
 * filtered them against the feed's keywords or the reader rejected them by
 * hand. This matches what the Filtered view lists.
 */
```

```ts
      status: "FILTERED",
```

```ts
      count: row.filtered,
```

- [ ] **Step 7: Update the stats tests**

In `tests/unit/statsTransforms.test.ts` and
`tests/integration/statsRepository.test.ts`, drop `notInterested` from every
expected row object and change any `status: "NOT_INTERESTED"` fixture to
`status: "FILTERED"`, folding its expected count into `filtered`.

For example, the "counts the two rejection sources separately" test becomes:

```ts
it("counts every rejected article for the day", () => {
  const rows = shapeRejectedArticlesPerDay(
    ["2026-03-01"],
    [
      rejected("FILTERED", "2026-03-01T08:00:00.000Z"),
      rejected("FILTERED", "2026-03-01T20:00:00.000Z"),
      rejected("FILTERED", "2026-03-01T12:00:00.000Z"),
    ],
  );

  expect(rows).toEqual([{ date: "2026-03-01", filtered: 3 }]);
});
```

and the zeroed-rows test becomes:

```ts
expect(shapeRejectedArticlesPerDay(["2026-03-01", "2026-03-02"], [])).toEqual([
  { date: "2026-03-01", filtered: 0 },
  { date: "2026-03-02", filtered: 0 },
]);
```

Apply the same two shapes to the remaining cases in both files.

Run:
`npx vitest run --project node tests/unit/statsTransforms.test.ts tests/integration/statsRepository.test.ts`

Expected: PASS.

- [ ] **Step 8: Update the chart**

In `src/app/feed/daily-filtered-articles-chart.tsx`:

```tsx
const chartConfig = {
  filtered: { label: "Filtered", color: "var(--chart-2)" },
} satisfies ChartConfig;
```

Change the description prop:

```tsx
description =
  "Number of articles that never reached you each day, filtered by your keywords or rejected by hand";
```

Replace the two `<Bar>` elements with one:

```tsx
<Bar dataKey="filtered" fill={chartConfig.filtered.color} />
```

- [ ] **Step 9: Update the remaining call sites**

`src/app/feed/filtered/page.tsx:27`:

```tsx
      status: "FILTERED",
```

`src/app/feed/[feedId]/page.tsx:47`:

```tsx
            ? "FILTERED"
```

`src/components/article/article-card-actions.tsx:47`:

```tsx
    {article.status !== "FILTERED" && (
```

`src/components/article/article-card.tsx`, replacing the reason block:

```tsx
{
  props.article.status === "FILTERED" && (
    <p className="text-muted-foreground border-l-2 pl-3 text-sm italic">
      {props.article.filterReason || "Filtered against this feed's keywords."}
    </p>
  );
}
```

The old fallback here read "You marked this as not interesting." for an article
with no `filterReason` — which was always a model verdict, never a reader one,
so the wording was wrong before this change and would be conspicuously wrong
after it.

`prisma/seed.ts:307`, so the seeded rejections still cover both wordings:

```ts
          status: "FILTERED",
          statusChangedAt: rejectedAt,
          filterReason: byModel
            ? "This is a funding round announcement, not a technical article."
            : "You marked this as not interested.",
```

- [ ] **Step 10: Update the component tests**

In `tests/components/article/dismiss-button.test.tsx`, change
`it.each(["READ", "FILTERED", "NOT_INTERESTED"] as const)` to
`it.each(["READ", "FILTERED"] as const)`.

In `tests/components/article/article-card-actions.test.tsx`, change any
`NOT_INTERESTED` fixture in the "hides the not-interested action for an
already-rejected article" test to `FILTERED`.

Run: `npx vitest run --project components`

Expected: PASS.

- [ ] **Step 11: Drop the enum member and migrate the data**

Remove `NOT_INTERESTED` from the `ArticleStatus` enum in `prisma/schema.prisma`.

Run: `npx prisma migrate dev --create-only --name drop_not_interested_status`

Prisma stores enums as `TEXT` on SQLite, so the generated migration body may be
empty or a plain table rebuild. Either way, open the generated `migration.sql`
and put these two statements at the **top**, before anything Prisma generated:

```sql
-- Write the reason before the status that identifies these rows is
-- overwritten; afterwards they can no longer be found.
UPDATE "Article"
SET "filterReason" = 'You marked this as not interested.'
WHERE "status" = 'NOT_INTERESTED' AND "filterReason" IS NULL;

UPDATE "Article"
SET "status" = 'FILTERED'
WHERE "status" = 'NOT_INTERESTED';
```

Then run: `npx prisma migrate dev`

Expected: the migration applies and the client regenerates.

- [ ] **Step 12: Verify everything**

Run: `npm run typecheck && npm run test && npm run lint`

Expected: PASS. `grep -rn "NOT_INTERESTED\|notInterested" src tests prisma`
should return nothing outside `src/generated/`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: file articles you reject by hand alongside filtered ones"
```

---

### Task 7: Keyword suggestions

**Files:**

- Modify: `src/lib/ai/prompts.ts`
- Create: `src/lib/ai/services/filterSuggestionService.ts`
- Modify: `src/lib/repository/feedRepository.ts`
- Test: `tests/unit/prompts.test.ts`
- Test: `tests/integration/filterSuggestionService.test.ts`

**Interfaces:**

- Consumes: `FeedFilter` (Task 2), `getFeedFilters` (Task 4).
- Produces:
  - `buildFilterSuggestionPrompt(title: string, summary: string, existingDisinterests: string[]): string`
  - `suggestFilterKeywords(articleId: number): Promise<string[]>`
  - `addFeedFilter(feedId: number, kind: FeedFilterKind, text: string): Promise<void>`
  - `removeFeedFilter(feedId: number, kind: FeedFilterKind, text: string): Promise<void>`

- [ ] **Step 1: Write the failing prompt test**

In `tests/unit/prompts.test.ts`, add `buildFilterSuggestionPrompt` to the
imports and append:

```ts
describe("buildFilterSuggestionPrompt", () => {
  it("includes the title and the summary", () => {
    const prompt = buildFilterSuggestionPrompt("A Title", "A summary.", []);

    expect(prompt).toContain("A Title");
    expect(prompt).toContain("A summary.");
  });

  it("asks for three topics at different breadths", () => {
    const prompt = buildFilterSuggestionPrompt("A Title", "A summary.", []);

    expect(prompt).toContain("exactly three");
    expect(prompt).toContain("narrow");
    expect(prompt).toContain("broad");
  });

  it("lists the entries the reader already has, to avoid repeating them", () => {
    const prompt = buildFilterSuggestionPrompt("A Title", "A summary.", [
      "advertisements",
    ]);

    expect(prompt).toContain("- advertisements");
  });

  it("omits the existing-entries block when there are none", () => {
    const prompt = buildFilterSuggestionPrompt("A Title", "A summary.", []);

    expect(prompt).not.toContain("already_excluded");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project node tests/unit/prompts.test.ts`

Expected: FAIL — no export named `buildFilterSuggestionPrompt`.

- [ ] **Step 3: Write the prompt builder**

Append to `src/lib/ai/prompts.ts`:

```ts
/**
 * Three suggestions at deliberately different breadths, because breadth is
 * what decides a conflict between the two lists: an entry that is narrower
 * than an opposing one wins. Three near-synonyms would leave the reader one
 * usable choice.
 *
 * Fed the stored lead rather than the scraped article. Naming what a piece is
 * about needs eighty words, and the ingest call already paid for the long read.
 */
export const buildFilterSuggestionPrompt = (
  title: string,
  summary: string,
  existingDisinterests: string[],
) => {
  const alreadyExcluded =
    existingDisinterests.length === 0
      ? ""
      : `

The reader already excludes these, so do not repeat them or propose a close
rewording of one:

<already_excluded>
${existingDisinterests.map((entry) => `- ${entry}`).join("\n")}
</already_excluded>`;

  return `A reader has just rejected the article below. Propose exactly three topic
descriptions they could add to a list of subjects they do not want from this
feed.

Give the three at different breadths, from narrow to broad:

1. narrow — the specific subject of this article
2. medium — the wider category it belongs to
3. broad — the general area, which would exclude a good deal more

Each must be a short noun phrase describing a subject, not an instruction and
not a sentence. Write them in the same language as the summary below. Describe
what the article is about, never the fact that the reader disliked it.${alreadyExcluded}

<article>
<title>${title}</title>
<summary>
${summary}
</summary>
</article>`;
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --project node tests/unit/prompts.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing service test**

Create `tests/integration/filterSuggestionService.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createArticle,
  createFeed,
  createFeedFilter,
  createUser,
} from "../helpers/factories";

vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn(async () => ({
    modelId: "test-model",
  })),
}));
vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: { suggestions: ["narrow", "medium", "broad"] },
    usage: { inputTokens: 5, outputTokens: 2 },
  })),
}));

import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("suggestFilterKeywords", () => {
  it("returns the three generated suggestions", async () => {
    const article = await createArticle({ userId, feedId });

    expect(await suggestFilterKeywords(article.id)).toEqual([
      "narrow",
      "medium",
      "broad",
    ]);
  });

  it("prompts with the stored lead when there is one", async () => {
    const article = await createArticle({ userId, feedId });
    await prisma.articleLead.create({
      data: { articleId: article.id, text: "The stored lead." },
    });

    await suggestFilterKeywords(article.id);

    const [call] = vi.mocked(generateObject).mock.calls;
    expect((call[0] as any).prompt).toContain("The stored lead.");
  });

  it("passes the feed's existing disinterests so they are not repeated", async () => {
    const article = await createArticle({ userId, feedId });
    await createFeedFilter({
      feedId,
      kind: "DISINTEREST",
      text: "advertisements",
    });
    await createFeedFilter({ feedId, kind: "INTEREST", text: "kernel" });

    await suggestFilterKeywords(article.id);

    const [call] = vi.mocked(generateObject).mock.calls;
    expect((call[0] as any).prompt).toContain("- advertisements");
    expect((call[0] as any).prompt).not.toContain("- kernel");
  });

  it("records token usage", async () => {
    const article = await createArticle({ userId, feedId });

    await suggestFilterKeywords(article.id);

    expect(
      await prisma.tokenUsage.findFirst({ where: { userId } }),
    ).toMatchObject({ inputTokens: 5, outputTokens: 2 });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run:
`npx vitest run --project node tests/integration/filterSuggestionService.test.ts`

Expected: FAIL — cannot resolve `@/lib/ai/services/filterSuggestionService`.

- [ ] **Step 7: Write the service**

Create `src/lib/ai/services/filterSuggestionService.ts`:

```ts
"use server";

import { buildFilterSuggestionPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateObject } from "ai";
import { z } from "zod";
import { trackTokenUsage } from "./tokenUsageService";

const model = await getFirstConfiguredLanguageModel();

// No system prompt: the one shared across this module's neighbours casts the
// model as a news editor writing previews, which is the wrong role for naming
// topics to exclude.
const suggestionSchema = z.object({
  suggestions: z
    .array(z.string())
    .length(3)
    .describe(
      "Three topic descriptions, ordered narrow to broad. Short noun phrases.",
    ),
});

export const suggestFilterKeywords = async (articleId: number) => {
  const article = await prisma.article.findUniqueOrThrow({
    include: { feed: { include: { filters: true } }, lead: true },
    where: { id: articleId },
  });

  const existingDisinterests = article.feed.filters
    .filter((filter) => filter.kind === "DISINTEREST")
    .map((filter) => filter.text);

  const { object, usage } = await generateObject({
    model,
    schema: suggestionSchema,
    prompt: buildFilterSuggestionPrompt(
      article.title,
      article.lead?.text ?? article.description ?? "",
      existingDisinterests,
    ),
  });

  await trackTokenUsage(
    article.userId,
    model.modelId,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
  );

  logger.info(
    { articleId, feedId: article.feedId, model: model.modelId },
    "Filter keyword suggestions generated.",
  );

  return object.suggestions;
};
```

- [ ] **Step 8: Run it to verify it passes**

Run:
`npx vitest run --project node tests/integration/filterSuggestionService.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 9: Add the single-entry write actions**

Append to `src/lib/repository/feedRepository.ts`:

```ts
/**
 * Idempotent by way of `upsert` rather than
 * `createMany({ skipDuplicates: true })`, which Prisma's SQLite connector does
 * not support. Adding an entry that is already present is something the reader
 * meant, not an error to report.
 */
export const addFeedFilter = async (
  feedId: number,
  kind: FeedFilterKind,
  text: string,
) => {
  await prisma.feedFilter.upsert({
    where: { feedId_kind_text: { feedId, kind, text } },
    create: { feedId, kind, text },
    update: {},
  });

  revalidatePath("/feed", "layout");
};

export const removeFeedFilter = async (
  feedId: number,
  kind: FeedFilterKind,
  text: string,
) => {
  await prisma.feedFilter.deleteMany({ where: { feedId, kind, text } });

  revalidatePath("/feed", "layout");
};
```

- [ ] **Step 10: Verify types and commit**

Run: `npm run typecheck && npx vitest run --project node`

Expected: PASS.

```bash
git add src/lib/ai/prompts.ts src/lib/ai/services/filterSuggestionService.ts \
  src/lib/repository/feedRepository.ts tests/unit/prompts.test.ts \
  tests/integration/filterSuggestionService.test.ts
git commit -m "feat: suggest keywords for ignoring similar articles"
```

---

### Task 8: The "not interested" popover

**Files:**

- Modify: `src/components/article/not-interested-button.tsx`
- Test: `tests/components/article/not-interested-button.test.tsx`

**Interfaces:**

- Consumes: `markArticleAsNotInteresting` (Task 6); `KeywordListField` (Task 5);
  `suggestFilterKeywords` (Task 7); `addFeedFilter`, `removeFeedFilter` (Task
  7).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing component test**

Create `tests/components/article/not-interested-button.test.tsx`:

```tsx
import NotInterestedButton from "@/components/article/not-interested-button";
import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";
import { addFeedFilter } from "@/lib/repository/feedRepository";
import { markArticleAsNotInteresting } from "@/lib/repository/articleRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsNotInteresting: vi.fn().mockResolvedValue(undefined),
  restoreArticleStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repository/feedRepository", () => ({
  addFeedFilter: vi.fn().mockResolvedValue(undefined),
  removeFeedFilter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/services/filterSuggestionService", () => ({
  suggestFilterKeywords: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const article = {
  id: 1,
  feedId: 7,
  status: "UNREAD",
  title: "Test article",
} as any;

const openPopover = async () => {
  render(<NotInterestedButton article={article} />);
  await userEvent.click(screen.getByRole("button", { name: "Not interested" }));
};

describe("NotInterestedButton", () => {
  it("dismisses the article as soon as it is clicked", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue(["a", "b", "c"]);

    await openPopover();

    expect(markArticleAsNotInteresting).toHaveBeenCalledWith(1);
  });

  it("adds a suggestion to the feed's disinterests when its chip is clicked", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue([
      "USB driver development",
      "device drivers",
      "kernel internals",
    ]);

    await openPopover();
    await userEvent.click(
      await screen.findByRole("button", { name: "USB driver development" }),
    );

    expect(addFeedFilter).toHaveBeenCalledWith(
      7,
      "DISINTEREST",
      "USB driver development",
    );
  });

  it("offers the manual input while suggestions are still generating", async () => {
    vi.mocked(suggestFilterKeywords).mockReturnValue(new Promise(() => {}));

    await openPopover();

    expect(screen.getByLabelText("Add a keyword")).toBeTruthy();
  });

  it("offers the manual input when suggestions fail", async () => {
    vi.mocked(suggestFilterKeywords).mockRejectedValue(new Error("no model"));

    await openPopover();

    expect(await screen.findByText(/no suggestions/i)).toBeTruthy();
    expect(screen.getByLabelText("Add a keyword")).toBeTruthy();
  });

  it("adds a manually typed keyword", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue(["a", "b", "c"]);

    await openPopover();
    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "quarterly earnings roundups{Enter}",
    );

    expect(addFeedFilter).toHaveBeenCalledWith(
      7,
      "DISINTEREST",
      "quarterly earnings roundups",
    );
  });

  it("says that the change applies to future articles only", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue(["a", "b", "c"]);

    await openPopover();

    expect(screen.getByText(/applies to future articles/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
`npx vitest run --project components tests/components/article/not-interested-button.test.tsx`

Expected: FAIL — no popover renders; the button still fires a toast.

- [ ] **Step 3: Rewrite the button**

Replace `src/components/article/not-interested-button.tsx` entirely:

```tsx
"use client";

import KeywordListField from "@/components/feed/keyword-list-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Article } from "@/generated/prisma/client";
import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";
import {
  markArticleAsNotInteresting,
  restoreArticleStatus,
} from "@/lib/repository/articleRepository";
import {
  addFeedFilter,
  removeFeedFilter,
} from "@/lib/repository/feedRepository";
import { ThumbsDownIcon } from "lucide-react";
import { useState } from "react";

type SuggestionState =
  | { status: "generating" }
  | { status: "ready"; suggestions: string[] }
  | { status: "unavailable" };

const NotInterestedButton = ({
  article,
  variant = "secondary",
}: {
  article: Article;
  variant?: "secondary" | "ghost";
}) => {
  const [open, setOpen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(article.status);
  const [suggestions, setSuggestions] = useState<SuggestionState>({
    status: "generating",
  });
  const [added, setAdded] = useState<string[]>([]);

  // The dismissal commits here, before the popover has taught anything.
  // Escaping the popover therefore leaves the article dismissed and the filter
  // untouched, which is the intended split: the popover is about the filter,
  // never about the article.
  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      return;
    }

    setPreviousStatus(article.status);
    setSuggestions({ status: "generating" });
    setAdded([]);

    await markArticleAsNotInteresting(article.id);

    try {
      const generated = await suggestFilterKeywords(article.id);
      setSuggestions({ status: "ready", suggestions: generated });
    } catch {
      // Not an error the reader has to act on — the manual input below is
      // unaffected, and the article is already dismissed.
      setSuggestions({ status: "unavailable" });
    }
  };

  const handleKeywordsChange = async (next: string[]) => {
    const inserted = next.find((entry) => !added.includes(entry));
    const removed = added.find((entry) => !next.includes(entry));

    setAdded(next);

    if (inserted) {
      await addFeedFilter(article.feedId, "DISINTEREST", inserted);
    }

    if (removed) {
      await removeFeedFilter(article.feedId, "DISINTEREST", removed);
    }
  };

  const unusedSuggestions =
    suggestions.status === "ready"
      ? suggestions.suggestions.filter((entry) => !added.includes(entry))
      : [];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          className="cursor-pointer"
          aria-label="Not interested"
        >
          <ThumbsDownIcon className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex w-80 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Marked as not interested</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto cursor-pointer p-0"
            onClick={async () => {
              await restoreArticleStatus(article.id, previousStatus);
              setOpen(false);
            }}
          >
            Undo
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Stop showing articles like this one:
        </p>

        {suggestions.status === "generating" && (
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        )}

        {suggestions.status === "unavailable" && (
          <p className="text-muted-foreground text-sm italic">
            No suggestions available — add one yourself below.
          </p>
        )}

        {unusedSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {unusedSuggestions.map((suggestion) => (
              <Badge key={suggestion} asChild variant="outline">
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => handleKeywordsChange([...added, suggestion])}
                >
                  {suggestion}
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Rendered in every state, never only as a fallback: a reader who
            wants to type their own should not have to wait for the model, and
            must still be able to filter when there is no model at all. */}
        <KeywordListField
          inputLabel="Add a keyword"
          onChange={handleKeywordsChange}
          placeholder="press releases"
          value={added}
        />

        <p className="text-muted-foreground text-xs">
          Applies to future articles.
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default NotInterestedButton;
```

- [ ] **Step 4: Run it to verify it passes**

Run:
`npx vitest run --project components tests/components/article/not-interested-button.test.tsx`

Expected: PASS, 6 tests.

If the chip assertion fails because `Badge asChild` does not forward the
accessible name, query by text instead of by role in that one test.

- [ ] **Step 5: Run everything**

Run:
`npm run format && npm run lint && npm run typecheck && npm run test && npm run build`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/article/not-interested-button.tsx \
  tests/components/article/not-interested-button.test.tsx
git commit -m "feat: teach a feed's filter when you reject an article"
```

---

### Task 9: Manual verification and release notes

The four arbitration clauses are model behaviour, not code paths. Asserting them
against a mocked model proves only that the mock returns what it was told to, so
they are checked by hand once, here.

**Files:**

- Modify: `README.md` (only if it documents the interest profile)

- [ ] **Step 1: Reseed and start the app**

```bash
npx prisma db seed
npm run dev
```

- [ ] **Step 2: Check the derived mode**

Open a feed's settings. With both lists empty, the description must read "No
filtering — every article from this feed is kept." Add one interest and confirm
it changes to "Only …" before you save. Add one disinterest and confirm it
becomes "Only …, except …".

- [ ] **Step 3: Check clause 2 in both directions**

On a feed with real articles, set interests to `Linux kernel development` and
disinterests to `USB driver development`, then refresh the feed. A USB driver
article must be filtered and a scheduler article must not.

Then set disinterests to `politics` and interests to
`politics in the Faroe Islands`. A Faroese politics article must survive; other
politics must not.

Both are one refresh each; check `filterReason` in the Filtered view to see
which entry the model applied.

- [ ] **Step 4: Check the popover end to end**

Click "Not interested" on an article. Confirm: the article disappears from the
inbox immediately; three suggestions appear at visibly different breadths; the
text input is usable before they arrive; clicking a chip and typing a keyword
both land in the feed's disinterest list; Undo restores the article.

- [ ] **Step 5: Note the breaking change**

Add to the PR description, for the release notes: existing interest profiles are
not migrated. Readers who wrote one must re-enter it as keywords. Every feed
gains "advertisements" and "sponsored posts" as disinterests, which turns
filtering on for feeds that had it off — deleting both entries turns it back
off.

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin feat/feed-filter-keywords
gh pr create --title "feat: filter feeds with interest and disinterest keywords" --body "$(cat <<'EOF'
Replaces the free-text interest profile with two per-feed keyword lists, and
turns the "Not interested" button into the way you add to the second one.

Design: `docs/superpowers/specs/2026-08-15-feed-filter-keywords-design.md`
Plan: `docs/superpowers/plans/2026-08-15-feed-filter-keywords.md`

## Breaking changes

- Existing interest profiles are **not** migrated. Anyone who wrote one has to
  re-enter it as keywords. There is no honest automatic translation from a
  paragraph into two lists.
- Every feed gains "advertisements" and "sponsored posts" as disinterests, so
  filtering is now on by default — including for feeds that previously had it
  off, which now pay the filtering prompt on every article. Deleting both
  entries turns it back off.
- `ArticleStatus.NOT_INTERESTED` is gone. Articles you rejected by hand are
  migrated to `FILTERED` with a reason, and the rejected-articles chart loses
  its model-versus-reader split as a result.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI. Do not merge — the user reviews and merges.
