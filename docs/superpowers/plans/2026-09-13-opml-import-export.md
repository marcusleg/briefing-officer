# OPML Import and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reader export their feed list as an OPML file and import an OPML
file from another reader, from two new sidebar entries.

**Architecture:** A pure module `src/lib/opml.ts` parses and serialises OPML
with `htmlparser2` (already a dependency) and hand-written XML output. A
`"use server"` repository `src/lib/repository/opmlRepository.ts` does the
database work: import inserts feed rows the way `createFeed` would leave them
and refreshes them after the response via Next's `after()`; export groups the
user's feeds by category. A `GET` route handler at `/api/opml` serves the
download; a dialog in the sidebar drives the import. No schema change.

**Tech Stack:** Next.js 16 App Router (server actions, route handlers, `after`
from `next/server`), Prisma 7 + SQLite, `htmlparser2`, shadcn/ui + Radix, Vitest
(node + jsdom projects), Testing Library.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-09-13-opml-import-export-design.md`.
- **Commits:** Conventional Commits, no scopes. `feat:` wording is user-facing —
  it goes in the changelog.
- **Never** use `git commit --no-verify`. The Husky hook runs `lint-staged`.
- **Branch:** `feat/opml-import-export`, in the worktree at
  `.claude/worktrees/feat-opml-import-export`. Do not push to `main`.
- **Before pushing:** `npm run format`, `npm run lint`, `npm run typecheck`,
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npm run test`, and
  `npm run build` must all pass.
- **Every test command needs a consent variable.** `vitest.setup.ts` runs
  `prisma db push`, which Prisma 7 blocks for AI agents. Prefix every run with
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes`.
- **`"use server"` modules may only export async functions.** Types, classes,
  and constants live in `src/lib/opml.ts`, never in the repository module.
- **Prisma SQLite limits:** no `String[]` scalar lists; `createMany` does not
  support `skipDuplicates`. Deduplicate in JavaScript first.
- **Default disinterests** are `DEFAULT_DISINTERESTS` from
  `src/lib/feedFilters.ts`, exactly `["advertisements", "sponsored posts"]`.
- **Reader-facing strings**, verbatim:
  - Not OPML: `This file is not an OPML document.`
  - No file: `Choose an OPML file to import.`
  - Unexpected failure: `Importing failed. Please try again.`
  - Export document title: `Briefing Officer feeds`
  - Download file name: `briefing-officer.opml`

## Deviations from the spec, and why

Both are deliberate. Do not "fix" them back; the spec has been updated to match.

1. **`importOpml` returns a result union instead of throwing.** Next.js masks
   the message of any error thrown by a server action in production, so a thrown
   "This file is not an OPML document." would reach the dialog as a generic
   error. The action returns `{ ok: false, error }` for expected failures and
   reserves throwing for the unexpected, which the dialog maps to the generic
   message.
2. **Export omits categories that have no feeds.** The spec did not say either
   way. An empty folder in the file would make another reader create an empty
   category, which is noise, and this application never creates empty categories
   on import either.

---

### Task 1: OPML parsing and serialising

Pure functions, no database. Everything later builds on these types.

**Files:**

- Create: `src/lib/opml.ts`
- Test: `tests/unit/opml.test.ts`

**Interfaces:**

- Consumes: `htmlparser2` (`parseDocument`, `DomUtils`), `domhandler` types.
- Produces:
  - `class InvalidOpmlError extends Error` — message
    `This file is not an OPML document.`
  - `interface OpmlFeedEntry { title: string; xmlUrl: string; category: string | null }`
  - `interface ParsedOpml { entries: OpmlFeedEntry[] }`
  - `parseOpml(text: string): ParsedOpml` — throws `InvalidOpmlError`.
  - `interface OpmlExportFeed { title: string; xmlUrl: string }`
  - `interface OpmlExportCategory { name: string | null; feeds: OpmlExportFeed[] }`
  - `buildOpml(title: string, categories: OpmlExportCategory[], createdAt?: Date): string`
  - `type OpmlImportResult = { ok: true; imported: number; skipped: number; categoriesCreated: number; unusable: string[] } | { ok: false; error: string }`
  - `isHttpUrl(value: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/opml.test.ts`:

```ts
import { buildOpml, InvalidOpmlError, isHttpUrl, parseOpml } from "@/lib/opml";
import { describe, expect, it } from "vitest";

const wrap = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Subscriptions</title></head>
  <body>
${body}
  </body>
</opml>`;

describe("parseOpml", () => {
  it("reads a flat list of feeds as uncategorised entries", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline type="rss" text="One" title="One" xmlUrl="https://one.example/feed"/>
         <outline type="rss" text="Two" title="Two" xmlUrl="https://two.example/feed"/>`,
      ),
    );

    expect(entries).toEqual([
      { title: "One", xmlUrl: "https://one.example/feed", category: null },
      { title: "Two", xmlUrl: "https://two.example/feed", category: null },
    ]);
  });

  it("uses the enclosing folder as the category", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline text="Tech" title="Tech">
           <outline type="rss" text="One" xmlUrl="https://one.example/feed"/>
         </outline>
         <outline type="rss" text="Loose" xmlUrl="https://loose.example/feed"/>`,
      ),
    );

    expect(entries).toEqual([
      { title: "One", xmlUrl: "https://one.example/feed", category: "Tech" },
      { title: "Loose", xmlUrl: "https://loose.example/feed", category: null },
    ]);
  });

  it("flattens nested folders to the innermost one", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline text="Tech">
           <outline text="Linux">
             <outline type="rss" text="LWN" xmlUrl="https://lwn.example/feed"/>
           </outline>
         </outline>`,
      ),
    );

    expect(entries[0].category).toBe("Linux");
  });

  it("prefers title over text, and falls back to the URL when both are missing", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline type="rss" text="From text" title="From title" xmlUrl="https://a.example/feed"/>
         <outline type="rss" text="Only text" xmlUrl="https://b.example/feed"/>
         <outline type="rss" xmlUrl="https://c.example/feed"/>`,
      ),
    );

    expect(entries.map((entry) => entry.title)).toEqual([
      "From title",
      "Only text",
      "https://c.example/feed",
    ]);
  });

  it("ignores outlines without an xmlUrl that contain no feeds", () => {
    const { entries } = parseOpml(
      wrap(`<outline text="Empty folder"/><outline text="Just a note"/>`),
    );

    expect(entries).toEqual([]);
  });

  it("decodes entities in attributes and trims whitespace", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline text="Tom &amp; Jerry">
           <outline type="rss" text=" Cats " xmlUrl="https://x.example/feed?a=1&amp;b=2"/>
         </outline>`,
      ),
    );

    expect(entries).toEqual([
      {
        title: "Cats",
        xmlUrl: "https://x.example/feed?a=1&b=2",
        category: "Tom & Jerry",
      },
    ]);
  });

  it("matches attribute names case-insensitively", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline type="rss" text="Lower" xmlurl="https://l.example/feed"/>`,
      ),
    );

    expect(entries[0].xmlUrl).toBe("https://l.example/feed");
  });

  it("throws InvalidOpmlError for text that is not OPML", () => {
    expect(() => parseOpml("hello")).toThrow(InvalidOpmlError);
    expect(() => parseOpml("<rss><channel/></rss>")).toThrow(InvalidOpmlError);
    expect(() => parseOpml('<opml version="2.0"><head/></opml>')).toThrow(
      "This file is not an OPML document.",
    );
  });
});

describe("buildOpml", () => {
  const createdAt = new Date(Date.UTC(2026, 8, 13, 10, 0, 0));

  it("writes uncategorised feeds at body level and categories as nested outlines", () => {
    const opml = buildOpml(
      "Briefing Officer feeds",
      [
        {
          name: null,
          feeds: [{ title: "Loose", xmlUrl: "https://loose.example/feed" }],
        },
        {
          name: "Tech",
          feeds: [{ title: "LWN", xmlUrl: "https://lwn.example/feed" }],
        },
      ],
      createdAt,
    );

    expect(opml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Briefing Officer feeds</title>
    <dateCreated>Sun, 13 Sep 2026 10:00:00 GMT</dateCreated>
  </head>
  <body>
    <outline text="Loose" title="Loose" type="rss" xmlUrl="https://loose.example/feed"/>
    <outline text="Tech" title="Tech">
      <outline text="LWN" title="LWN" type="rss" xmlUrl="https://lwn.example/feed"/>
    </outline>
  </body>
</opml>
`);
  });

  it("escapes XML special characters in titles and URLs", () => {
    const opml = buildOpml(
      "T <&>",
      [
        {
          name: 'A & "B"',
          feeds: [{ title: "<b>", xmlUrl: "https://x.example/?a=1&b=2" }],
        },
      ],
      createdAt,
    );

    expect(opml).toContain("<title>T &lt;&amp;&gt;</title>");
    expect(opml).toContain('text="A &amp; &quot;B&quot;"');
    expect(opml).toContain('text="&lt;b&gt;"');
    expect(opml).toContain('xmlUrl="https://x.example/?a=1&amp;b=2"');
  });

  it("sorts categories by name and feeds by title, case-insensitively", () => {
    const opml = buildOpml(
      "t",
      [
        {
          name: "zebra",
          feeds: [
            { title: "beta", xmlUrl: "https://b.example" },
            { title: "Alpha", xmlUrl: "https://a.example" },
          ],
        },
        { name: "Apple", feeds: [{ title: "x", xmlUrl: "https://x.example" }] },
        {
          name: null,
          feeds: [
            { title: "Second", xmlUrl: "https://2.example" },
            { title: "first", xmlUrl: "https://1.example" },
          ],
        },
      ],
      createdAt,
    );

    const order = [...opml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual([
      "first",
      "Second",
      "Apple",
      "x",
      "zebra",
      "Alpha",
      "beta",
    ]);
  });

  it("omits categories that have no feeds", () => {
    const opml = buildOpml("t", [{ name: "Empty", feeds: [] }], createdAt);

    expect(opml).not.toContain("Empty");
  });

  it("parses its own output back to the same entries", () => {
    const opml = buildOpml(
      "t",
      [
        {
          name: null,
          feeds: [{ title: "Loose", xmlUrl: "https://loose.example/feed" }],
        },
        {
          name: "Tech",
          feeds: [{ title: "LWN", xmlUrl: "https://lwn.example/feed" }],
        },
      ],
      createdAt,
    );

    expect(parseOpml(opml).entries).toEqual([
      { title: "Loose", xmlUrl: "https://loose.example/feed", category: null },
      { title: "LWN", xmlUrl: "https://lwn.example/feed", category: "Tech" },
    ]);
  });
});

describe("isHttpUrl", () => {
  it("accepts absolute http and https URLs only", () => {
    expect(isHttpUrl("https://example.com/feed")).toBe(true);
    expect(isHttpUrl("http://example.com/feed")).toBe(true);
    expect(isHttpUrl("ftp://example.com/feed")).toBe(false);
    expect(isHttpUrl("example.com/feed")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run tests/unit/opml.test.ts`

Expected: FAIL — cannot resolve `@/lib/opml`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/opml.ts`:

```ts
import type { AnyNode, Element } from "domhandler";
import { DomUtils, parseDocument } from "htmlparser2";

/**
 * Thrown by parseOpml when the text has no <opml> root with a <body>. The
 * message is reader-facing: the import dialog shows it verbatim.
 */
export class InvalidOpmlError extends Error {
  constructor() {
    super("This file is not an OPML document.");
    this.name = "InvalidOpmlError";
  }
}

export interface OpmlFeedEntry {
  title: string;
  xmlUrl: string;
  /** The innermost enclosing folder, or null for a feed at body level. */
  category: string | null;
}

export interface ParsedOpml {
  entries: OpmlFeedEntry[];
}

export interface OpmlExportFeed {
  title: string;
  xmlUrl: string;
}

export interface OpmlExportCategory {
  /** null groups the uncategorised feeds, which are emitted at body level. */
  name: string | null;
  feeds: OpmlExportFeed[];
}

/**
 * Returned rather than thrown for expected failures because Next.js masks the
 * message of an error thrown by a server action in production, and the dialog
 * needs the message.
 */
export type OpmlImportResult =
  | {
      ok: true;
      imported: number;
      /** Already subscribed, or listed more than once in the file. */
      skipped: number;
      categoriesCreated: number;
      /** Titles of entries whose xmlUrl was not an absolute http(s) URL. */
      unusable: string[];
    }
  | { ok: false; error: string };

// Attribute names are matched case-insensitively: the spec writes xmlUrl, and
// some exporters write xmlurl.
const attribute = (element: Element, name: string): string | undefined => {
  const wanted = name.toLowerCase();
  const key = Object.keys(element.attribs).find(
    (candidate) => candidate.toLowerCase() === wanted,
  );
  return key === undefined ? undefined : element.attribs[key].trim();
};

const isOutline = (node: AnyNode): node is Element =>
  DomUtils.isTag(node) && node.name.toLowerCase() === "outline";

const hasTagName = (name: string) => (candidate: string) =>
  candidate.toLowerCase() === name;

// Walks up from a feed outline to the first enclosing outline that is not a
// feed itself. Nesting deeper than one level is flattened to the innermost
// folder: the application has one level of categories, and the innermost
// name is the most specific.
const enclosingFolder = (element: Element): string | null => {
  let parent = element.parent;
  while (parent && isOutline(parent)) {
    if (!attribute(parent, "xmlUrl")) {
      return attribute(parent, "text") || attribute(parent, "title") || null;
    }
    parent = parent.parent;
  }
  return null;
};

export const parseOpml = (text: string): ParsedOpml => {
  const document = parseDocument(text, { xmlMode: true });

  const [root] = DomUtils.getElementsByTagName(
    hasTagName("opml"),
    document.children,
    false,
    1,
  );
  const [body] = root
    ? DomUtils.getElementsByTagName(hasTagName("body"), root.children, false, 1)
    : [];

  if (!body) {
    throw new InvalidOpmlError();
  }

  const entries = DomUtils.findAll(isOutline, body.children).flatMap(
    (outline) => {
      const xmlUrl = attribute(outline, "xmlUrl");
      if (!xmlUrl) {
        return [];
      }

      return [
        {
          title:
            attribute(outline, "title") || attribute(outline, "text") || xmlUrl,
          xmlUrl,
          category: enclosingFolder(outline),
        },
      ];
    },
  );

  return { entries };
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);

const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

const byTitle = (a: OpmlExportFeed, b: OpmlExportFeed) =>
  compareText(a.title, b.title);

const feedOutline = (feed: OpmlExportFeed, indent: string) => {
  const title = escapeXml(feed.title);
  return `${indent}<outline text="${title}" title="${title}" type="rss" xmlUrl="${escapeXml(feed.xmlUrl)}"/>`;
};

/**
 * Serialises by hand: the output is small and regular, and a builder library
 * is not worth a dependency. Uncategorised feeds come first, then categories
 * sorted by name, each with its feeds sorted by title — the sidebar's order.
 * Categories without feeds are left out; an empty folder would only make
 * another reader create an empty category.
 */
export const buildOpml = (
  title: string,
  categories: OpmlExportCategory[],
  createdAt: Date = new Date(),
): string => {
  const uncategorised = categories
    .filter((category) => category.name === null)
    .flatMap((category) => category.feeds)
    .sort(byTitle);

  const named = categories
    .filter(
      (category): category is OpmlExportCategory & { name: string } =>
        category.name !== null && category.feeds.length > 0,
    )
    .sort((a, b) => compareText(a.name, b.name));

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${escapeXml(title)}</title>`,
    `    <dateCreated>${createdAt.toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    ...uncategorised.map((feed) => feedOutline(feed, "    ")),
    ...named.flatMap((category) => {
      const name = escapeXml(category.name);
      return [
        `    <outline text="${name}" title="${name}">`,
        ...[...category.feeds]
          .sort(byTitle)
          .map((feed) => feedOutline(feed, "      ")),
        "    </outline>",
      ];
    }),
    "  </body>",
    "</opml>",
    "",
  ];

  return lines.join("\n");
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run tests/unit/opml.test.ts`

Expected: PASS, 14 tests.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx prettier --write src/lib/opml.ts tests/unit/opml.test.ts
npm run lint && npm run typecheck
git add src/lib/opml.ts tests/unit/opml.test.ts
git commit -m "feat: parse and build OPML feed lists

Pure module behind the upcoming import and export. Parsing walks every
outline with an xmlUrl and takes the innermost enclosing folder as its
category; serialising writes OPML 2.0 by hand with escaped attributes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016JBYhTACTZPTGGS96R6EHG"
```

---

### Task 2: Import and export server actions

**Files:**

- Create: `src/lib/repository/opmlRepository.ts`
- Test: `tests/integration/opmlRepository.test.ts`

**Interfaces:**

- Consumes from Task 1: `parseOpml`, `buildOpml`, `isHttpUrl`,
  `InvalidOpmlError`, `OpmlImportResult`, `OpmlExportFeed`, `ParsedOpml`.
- Consumes from the codebase: `getUserId()` from
  `@/lib/repository/userRepository`, `refreshFeed(feedId)` from
  `@/lib/repository/feedRepository`, `DEFAULT_DISINTERESTS` from
  `@/lib/feedFilters`, `prisma`, `logger`, `after` from `next/server`,
  `revalidatePath` from `next/cache`.
- Produces:
  - `importOpml(formData: FormData): Promise<OpmlImportResult>` — reads the
    `file` field.
  - `exportOpml(): Promise<string>` — the OPML document for the signed-in user.

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/opmlRepository.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, createFeed, createUser } from "../helpers/factories";

// --- Boundary mocks (hoisted by Vitest) ---
vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));
vi.mock("@/lib/scraper", () => ({
  scrapeFeed: vi.fn(),
  scrapeArticle: vi.fn(),
}));
vi.mock("@/lib/ai/services/leadService", () => ({
  generateAiLead: vi.fn(),
}));
// after() only works inside a Next request; run the callback right away so
// the test can await the refreshes it schedules.
vi.mock("next/server", () => ({
  after: vi.fn((callback: () => unknown) => callback()),
}));

import { DEFAULT_DISINTERESTS } from "@/lib/feedFilters";
import { exportOpml, importOpml } from "@/lib/repository/opmlRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { scrapeFeed } from "@/lib/scraper";
import { after } from "next/server";

let userId: string;

const opml = (body: string) =>
  `<?xml version="1.0"?><opml version="2.0"><head><title>t</title></head><body>${body}</body></opml>`;

const formWith = (content: string, name = "feeds.opml") => {
  const formData = new FormData();
  formData.append("file", new File([content], name, { type: "text/xml" }));
  return formData;
};

const feedOutline = (title: string, xmlUrl: string) =>
  `<outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}"/>`;

// The refreshes are scheduled with after(); awaiting its mock's return value
// waits for them.
const settleRefreshes = () =>
  Promise.all(vi.mocked(after).mock.results.map((result) => result.value));

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  vi.mocked(scrapeFeed).mockResolvedValue([]);
});

describe("opmlRepository.importOpml", () => {
  it("creates feeds and categories from the file and reports the counts", async () => {
    const result = await importOpml(
      formWith(
        opml(
          `<outline text="Tech">${feedOutline("LWN", "https://lwn.example/feed")}</outline>` +
            feedOutline("Loose", "https://loose.example/feed"),
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      imported: 2,
      skipped: 0,
      categoriesCreated: 1,
      unusable: [],
    });

    const feeds = await prisma.feed.findMany({
      where: { userId },
      include: { FeedCategory: true },
      orderBy: { title: "asc" },
    });
    expect(
      feeds.map((feed) => [feed.title, feed.link, feed.FeedCategory?.name]),
    ).toEqual([
      ["Loose", "https://loose.example/feed", undefined],
      ["LWN", "https://lwn.example/feed", "Tech"],
    ]);
    expect(feeds.every((feed) => feed.autoRefresh)).toBe(true);
    expect(feeds.every((feed) => feed.lastFetched.getTime() === 0)).toBe(true);
  });

  it("seeds the default disinterests on every imported feed", async () => {
    await importOpml(
      formWith(opml(feedOutline("One", "https://one.example/feed"))),
    );

    const feed = await prisma.feed.findFirstOrThrow({ where: { userId } });
    const filters = await prisma.feedFilter.findMany({
      where: { feedId: feed.id },
      orderBy: { text: "asc" },
    });
    expect(filters.map((filter) => [filter.kind, filter.text])).toEqual(
      [...DEFAULT_DISINTERESTS].sort().map((text) => ["DISINTEREST", text]),
    );
  });

  it("matches an existing category case-insensitively instead of creating a duplicate", async () => {
    const existing = await createCategory({ userId, name: "Tech" });

    const result = await importOpml(
      formWith(
        opml(
          `<outline text="tech">${feedOutline("LWN", "https://lwn.example/feed")}</outline>`,
        ),
      ),
    );

    expect(result).toMatchObject({ ok: true, categoriesCreated: 0 });
    expect(await prisma.feedCategory.count({ where: { userId } })).toBe(1);
    const feed = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(feed.feedCategoryId).toBe(existing.id);
  });

  it("creates a category once when several entries share it", async () => {
    const result = await importOpml(
      formWith(
        opml(
          `<outline text="Tech">${feedOutline("A", "https://a.example/feed")}${feedOutline("B", "https://b.example/feed")}</outline>`,
        ),
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      imported: 2,
      categoriesCreated: 1,
    });
    expect(await prisma.feedCategory.count({ where: { userId } })).toBe(1);
  });

  it("skips feeds the reader already has and leaves them untouched", async () => {
    const category = await createCategory({ userId, name: "Kept" });
    await createFeed({
      userId,
      title: "Original title",
      link: "https://lwn.example/feed",
      feedCategoryId: category.id,
    });

    const result = await importOpml(
      formWith(
        opml(
          `<outline text="Other">${feedOutline("New title", "https://lwn.example/feed")}</outline>`,
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      imported: 0,
      skipped: 1,
      categoriesCreated: 0,
      unusable: [],
    });
    const feed = await prisma.feed.findFirstOrThrow({ where: { userId } });
    expect(feed.title).toBe("Original title");
    expect(feed.feedCategoryId).toBe(category.id);
    expect(await prisma.feedCategory.count({ where: { userId } })).toBe(1);
  });

  it("imports a URL listed twice in the file only once", async () => {
    const result = await importOpml(
      formWith(
        opml(
          feedOutline("First", "https://dup.example/feed") +
            feedOutline("Second", "https://dup.example/feed"),
        ),
      ),
    );

    expect(result).toMatchObject({ ok: true, imported: 1, skipped: 1 });
    expect(await prisma.feed.count({ where: { userId } })).toBe(1);
  });

  it("reports entries whose URL is not http(s) and imports the rest", async () => {
    const result = await importOpml(
      formWith(
        opml(
          feedOutline("Broken", "not a url") +
            feedOutline("Gopher", "gopher://old.example/feed") +
            feedOutline("Fine", "https://fine.example/feed"),
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      imported: 1,
      skipped: 0,
      categoriesCreated: 0,
      unusable: ["Broken", "Gopher"],
    });
  });

  it("refreshes every imported feed after the response", async () => {
    await importOpml(
      formWith(
        opml(
          feedOutline("A", "https://a.example/feed") +
            feedOutline("B", "https://b.example/feed"),
        ),
      ),
    );
    await settleRefreshes();

    expect(scrapeFeed).toHaveBeenCalledTimes(2);
    const links = vi
      .mocked(scrapeFeed)
      .mock.calls.map(([feed]) => feed.link)
      .sort();
    expect(links).toEqual(["https://a.example/feed", "https://b.example/feed"]);
  });

  it("does not see another user's feeds as already subscribed", async () => {
    const other = await createUser();
    await createFeed({ userId: other.id, link: "https://shared.example/feed" });

    const result = await importOpml(
      formWith(opml(feedOutline("Shared", "https://shared.example/feed"))),
    );

    expect(result).toMatchObject({ ok: true, imported: 1, skipped: 0 });
    expect(await prisma.feed.count({ where: { userId } })).toBe(1);
    expect(await prisma.feed.count({ where: { userId: other.id } })).toBe(1);
  });

  it("rejects a file that is not OPML without writing anything", async () => {
    const result = await importOpml(formWith("<rss><channel/></rss>"));

    expect(result).toEqual({
      ok: false,
      error: "This file is not an OPML document.",
    });
    expect(await prisma.feed.count({ where: { userId } })).toBe(0);
    expect(after).not.toHaveBeenCalled();
  });

  it("rejects a missing or empty file", async () => {
    expect(await importOpml(new FormData())).toEqual({
      ok: false,
      error: "Choose an OPML file to import.",
    });
    expect(await importOpml(formWith(""))).toEqual({
      ok: false,
      error: "Choose an OPML file to import.",
    });
  });
});

describe("opmlRepository.exportOpml", () => {
  it("groups the user's feeds by category with uncategorised feeds at body level", async () => {
    const tech = await createCategory({ userId, name: "Tech" });
    await createFeed({
      userId,
      title: "LWN",
      link: "https://lwn.example/feed",
      feedCategoryId: tech.id,
    });
    await createFeed({
      userId,
      title: "Loose",
      link: "https://loose.example/feed",
    });

    const result = await exportOpml();

    expect(result).toContain("<title>Briefing Officer feeds</title>");
    expect(result).toContain(
      `    <outline text="Loose" title="Loose" type="rss" xmlUrl="https://loose.example/feed"/>`,
    );
    expect(result).toContain(
      `    <outline text="Tech" title="Tech">\n      <outline text="LWN" title="LWN" type="rss" xmlUrl="https://lwn.example/feed"/>\n    </outline>`,
    );
  });

  it("excludes other users' feeds and empty categories", async () => {
    const other = await createUser();
    await createFeed({
      userId: other.id,
      title: "Theirs",
      link: "https://theirs.example/feed",
    });
    await createCategory({ userId, name: "Empty" });
    await createFeed({
      userId,
      title: "Mine",
      link: "https://mine.example/feed",
    });

    const result = await exportOpml();

    expect(result).toContain("Mine");
    expect(result).not.toContain("Theirs");
    expect(result).not.toContain("Empty");
  });

  it("exports a valid document when the user has no feeds", async () => {
    const result = await exportOpml();

    expect(result).toContain("<body>\n  </body>");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run tests/integration/opmlRepository.test.ts`

Expected: FAIL — cannot resolve `@/lib/repository/opmlRepository`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/repository/opmlRepository.ts`:

```ts
"use server";

import { DEFAULT_DISINTERESTS } from "@/lib/feedFilters";
import logger from "@/lib/logger";
import {
  buildOpml,
  InvalidOpmlError,
  isHttpUrl,
  OpmlExportFeed,
  OpmlImportResult,
  ParsedOpml,
  parseOpml,
} from "@/lib/opml";
import prisma from "@/lib/prismaClient";
import { refreshFeed } from "@/lib/repository/feedRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

const EXPORT_TITLE = "Briefing Officer feeds";

const readUpload = async (formData: FormData): Promise<string | null> => {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }
  return file.text();
};

/**
 * Inserts feed rows the way createFeed leaves them — lastFetched at epoch,
 * auto refresh on, default disinterests seeded — but does not fetch anything
 * first. A file may list a hundred feeds, and fetching each one before the
 * dialog can close would take minutes. Refreshes run after the response
 * instead; a URL that turns out not to be a feed logs an error on refresh and
 * sits empty, the same as a feed that dies after subscription does today.
 */
export const importOpml = async (
  formData: FormData,
): Promise<OpmlImportResult> => {
  const text = await readUpload(formData);
  if (text === null) {
    return { ok: false, error: "Choose an OPML file to import." };
  }

  let entries: ParsedOpml["entries"];
  try {
    ({ entries } = parseOpml(text));
  } catch (error) {
    if (error instanceof InvalidOpmlError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const userId = await getUserId();

  const [categories, feeds] = await Promise.all([
    prisma.feedCategory.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
    prisma.feed.findMany({ where: { userId }, select: { link: true } }),
  ]);

  // The schema forbids the same link twice per user, and the file is not a
  // source of truth for feeds the reader has already configured — a match is
  // skipped whole, title and category included. Adding to the set as we go
  // also folds a URL listed twice in one file into a single import.
  const subscribed = new Set(feeds.map((feed) => feed.link));
  const unusable: string[] = [];
  let skipped = 0;
  const toCreate = entries.filter((entry) => {
    if (!isHttpUrl(entry.xmlUrl)) {
      unusable.push(entry.title);
      return false;
    }
    if (subscribed.has(entry.xmlUrl)) {
      skipped += 1;
      return false;
    }
    subscribed.add(entry.xmlUrl);
    return true;
  });

  // Matched case-insensitively so a file that says "tech" does not put a
  // second category beside an existing "Tech".
  const categoryIdsByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );

  const { createdFeedIds, categoriesCreated } = await prisma.$transaction(
    async (tx) => {
      const createdFeedIds: number[] = [];
      let categoriesCreated = 0;

      for (const entry of toCreate) {
        let feedCategoryId: number | null = null;

        if (entry.category !== null) {
          const key = entry.category.toLowerCase();
          let categoryId = categoryIdsByName.get(key);
          if (categoryId === undefined) {
            const created = await tx.feedCategory.create({
              data: { userId, name: entry.category },
            });
            categoryId = created.id;
            categoryIdsByName.set(key, categoryId);
            categoriesCreated += 1;
          }
          feedCategoryId = categoryId;
        }

        const feed = await tx.feed.create({
          data: {
            title: entry.title,
            link: entry.xmlUrl,
            autoRefresh: true,
            lastFetched: new Date(0),
            userId,
            feedCategoryId,
            filters: {
              create: DEFAULT_DISINTERESTS.map((text) => ({
                kind: "DISINTEREST" as const,
                text,
              })),
            },
          },
        });
        createdFeedIds.push(feed.id);
      }

      return { createdFeedIds, categoriesCreated };
    },
  );

  revalidatePath("/feed", "layout");

  if (createdFeedIds.length > 0) {
    after(() =>
      Promise.all(
        createdFeedIds.map((feedId) =>
          refreshFeed(feedId).catch((error) =>
            logger.error(
              { err: error, feedId },
              "Failed to refresh a feed imported from OPML.",
            ),
          ),
        ),
      ),
    );
  }

  logger.info(
    {
      imported: createdFeedIds.length,
      skipped,
      categoriesCreated,
      unusable: unusable.length,
    },
    "Imported feeds from OPML.",
  );

  return {
    ok: true,
    imported: createdFeedIds.length,
    skipped,
    categoriesCreated,
    unusable,
  };
};

export const exportOpml = async (): Promise<string> => {
  const userId = await getUserId();

  const feeds = await prisma.feed.findMany({
    where: { userId },
    select: {
      title: true,
      link: true,
      FeedCategory: { select: { name: true } },
    },
  });

  const feedsByCategory = new Map<string | null, OpmlExportFeed[]>();
  for (const feed of feeds) {
    const name = feed.FeedCategory?.name ?? null;
    const group = feedsByCategory.get(name) ?? [];
    group.push({ title: feed.title, xmlUrl: feed.link });
    feedsByCategory.set(name, group);
  }

  return buildOpml(
    EXPORT_TITLE,
    [...feedsByCategory].map(([name, group]) => ({ name, feeds: group })),
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run tests/integration/opmlRepository.test.ts`

Expected: PASS, 14 tests.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx prettier --write src/lib/repository/opmlRepository.ts tests/integration/opmlRepository.test.ts
npm run lint && npm run typecheck
git add src/lib/repository/opmlRepository.ts tests/integration/opmlRepository.test.ts
git commit -m "feat: import feeds from an OPML file and export the feed list as OPML

Server actions only; the sidebar entries follow. Import creates missing
categories, skips feeds the reader already has, and refreshes the new
feeds after the response so a large file does not hold the dialog open.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016JBYhTACTZPTGGS96R6EHG"
```

---

### Task 3: Export download route

**Files:**

- Create: `src/app/api/opml/route.ts`
- Test: `tests/integration/opmlRoute.test.ts`

**Interfaces:**

- Consumes from Task 2: `exportOpml(): Promise<string>`.
- Consumes from the codebase: `auth.api.getSession({ headers })` from
  `@/lib/auth`, `headers()` from `next/headers`.
- Produces: `GET /api/opml` → 200 with the OPML document, or 401 when there is
  no session.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/opmlRoute.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/repository/opmlRepository", () => ({
  exportOpml: vi.fn(),
}));

import { GET } from "@/app/api/opml/route";
import { auth } from "@/lib/auth";
import { exportOpml } from "@/lib/repository/opmlRepository";

describe("GET /api/opml", () => {
  it("returns 401 without a session and exports nothing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(exportOpml).not.toHaveBeenCalled();
  });

  it("returns the OPML document as a download", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    vi.mocked(exportOpml).mockResolvedValue('<opml version="2.0"/>');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/x-opml; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="briefing-officer.opml"',
    );
    expect(await response.text()).toBe('<opml version="2.0"/>');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run tests/integration/opmlRoute.test.ts`

Expected: FAIL — cannot resolve `@/app/api/opml/route`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/opml/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { exportOpml } from "@/lib/repository/opmlRepository";
import { headers } from "next/headers";

// The session is checked here rather than relying on exportOpml's getUserId
// throwing, so that a missing session is a 401 and a database failure stays
// a 500 instead of both collapsing into one.
export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("", { status: 401 });
  }

  const opml = await exportOpml();

  return new Response(opml, {
    status: 200,
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="briefing-officer.opml"',
    },
  });
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run tests/integration/opmlRoute.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx prettier --write src/app/api/opml/route.ts tests/integration/opmlRoute.test.ts
npm run lint && npm run typecheck
git add src/app/api/opml/route.ts tests/integration/opmlRoute.test.ts
git commit -m "feat: serve the OPML export as a download at /api/opml

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016JBYhTACTZPTGGS96R6EHG"
```

---

### Task 4: Import dialog and sidebar entries

**Files:**

- Create: `src/components/navigation/import-opml-dialog-trigger.tsx`
- Modify: `src/components/navigation/add-nav-actions.tsx`
- Test: `tests/components/navigation/import-opml-dialog-trigger.test.tsx`

**Interfaces:**

- Consumes from Task 2:
  `importOpml(formData: FormData): Promise<OpmlImportResult>`.
- Consumes from Task 1: `OpmlImportResult`.
- Consumes from the codebase: `Dialog*` from `@/components/ui/dialog`, `Button`,
  `Input`, `Label`, `Alert`/`AlertDescription`,
  `SidebarMenuButton`/`SidebarMenuItem`, lucide icons.
- Produces: `ImportOpmlDialogTrigger({ children })` client component; two new
  sidebar items "Import OPML" and "Export OPML".

- [ ] **Step 1: Write the failing test**

Create `tests/components/navigation/import-opml-dialog-trigger.test.tsx`:

```tsx
import ImportOpmlDialogTrigger from "@/components/navigation/import-opml-dialog-trigger";
import { importOpml } from "@/lib/repository/opmlRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/opmlRepository", () => ({
  importOpml: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const openDialog = async () => {
  const user = userEvent.setup();
  render(
    <ImportOpmlDialogTrigger>
      <button>Import OPML</button>
    </ImportOpmlDialogTrigger>,
  );
  await user.click(screen.getByRole("button", { name: "Import OPML" }));
  return user;
};

const opmlFile = () =>
  new File(['<opml version="2.0"><body/></opml>'], "feeds.opml", {
    type: "text/xml",
  });

describe("ImportOpmlDialogTrigger", () => {
  it("keeps the Import button disabled until a file is chosen", async () => {
    const user = await openDialog();

    const importButton = screen.getByRole("button", { name: "Import" });
    expect(importButton).toBeDisabled();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());

    expect(importButton).toBeEnabled();
  });

  it("sends the chosen file to importOpml and shows the summary", async () => {
    vi.mocked(importOpml).mockResolvedValue({
      ok: true,
      imported: 12,
      skipped: 3,
      categoriesCreated: 2,
      unusable: ["Broken feed"],
    });
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(
        "Imported 12 feeds. Skipped 3 you already had. 2 categories created.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Broken feed")).toBeInTheDocument();

    const formData = vi.mocked(importOpml).mock.calls[0][0];
    expect(formData.get("file")).toBeInstanceOf(File);
    expect((formData.get("file") as File).name).toBe("feeds.opml");
  });

  it("uses singular wording for one of something", async () => {
    vi.mocked(importOpml).mockResolvedValue({
      ok: true,
      imported: 1,
      skipped: 1,
      categoriesCreated: 1,
      unusable: [],
    });
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(
        "Imported 1 feed. Skipped 1 you already had. 1 category created.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the action's error and keeps the form available", async () => {
    vi.mocked(importOpml).mockResolvedValue({
      ok: false,
      error: "This file is not an OPML document.",
    });
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText("This file is not an OPML document."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("shows a generic message when the action throws", async () => {
    vi.mocked(importOpml).mockRejectedValue(new Error("boom"));
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText("Importing failed. Please try again."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run --project components tests/components/navigation/import-opml-dialog-trigger.test.tsx`

Expected: FAIL — cannot resolve
`@/components/navigation/import-opml-dialog-trigger`.

- [ ] **Step 3: Write the dialog**

Create `src/components/navigation/import-opml-dialog-trigger.tsx`:

```tsx
"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OpmlImportResult } from "@/lib/opml";
import { importOpml } from "@/lib/repository/opmlRepository";
import { LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

interface ImportOpmlDialogTriggerProps {
  children: React.ReactNode;
}

const ACCEPTED_TYPES = ".opml,.xml,text/xml,application/xml,text/x-opml";

const count = (n: number, singular: string, pluralForm = `${singular}s`) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

const summarise = (result: Extract<OpmlImportResult, { ok: true }>) =>
  `Imported ${count(result.imported, "feed")}. ` +
  `Skipped ${result.skipped} you already had. ` +
  `${count(result.categoriesCreated, "category", "categories")} created.`;

const ImportOpmlDialogTrigger = ({
  children,
}: ImportOpmlDialogTriggerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<OpmlImportResult | null>(null);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setFile(null);
      setResult(null);
      setImporting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    setImporting(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      setResult(await importOpml(formData));
    } catch {
      // Next.js masks the message of an error thrown by a server action in
      // production, so there is nothing more specific to show here.
      setResult({ ok: false, error: "Importing failed. Please try again." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import OPML</DialogTitle>
          <DialogDescription>
            Subscribe to every feed in an OPML file exported from another
            reader. Feeds you already have are left as they are.
          </DialogDescription>
        </DialogHeader>

        {result?.ok ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">{summarise(result)}</p>
            {result.unusable.length > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <p>Could not import:</p>
                <ul className="text-muted-foreground list-disc pl-5">
                  {result.unusable.map((title, index) => (
                    <li key={`${index}-${title}`}>{title}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-row justify-end">
              <DialogClose asChild>
                <Button className="w-24 cursor-pointer">Close</Button>
              </DialogClose>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="opml-file">OPML file</Label>
              <Input
                id="opml-file"
                type="file"
                accept={ACCEPTED_TYPES}
                disabled={importing}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>

            {result && !result.ok && (
              <Alert variant="destructive">
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-row justify-end gap-2">
              <DialogClose asChild>
                <Button
                  className="w-24 cursor-pointer"
                  disabled={importing}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                className="w-24 cursor-pointer"
                disabled={importing || !file}
                type="submit"
              >
                {importing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportOpmlDialogTrigger;
```

- [ ] **Step 4: Add the sidebar entries**

Replace the whole of `src/components/navigation/add-nav-actions.tsx` with:

```tsx
"use client";

import AddCategoryFormDialogTrigger from "@/components/category/add-category-form-dialog-trigger";
import AddFeedFormDialogTrigger from "@/components/navigation/add-feed-form-dialog-trigger";
import ImportOpmlDialogTrigger from "@/components/navigation/import-opml-dialog-trigger";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { DownloadIcon, PlusIcon, UploadIcon } from "lucide-react";

const AddNavActions = () => (
  <>
    <SidebarMenuItem>
      <AddCategoryFormDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <PlusIcon />
          <span className="truncate">Add Category</span>
        </SidebarMenuButton>
      </AddCategoryFormDialogTrigger>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <AddFeedFormDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <PlusIcon />
          <span className="truncate">Add Feed</span>
        </SidebarMenuButton>
      </AddFeedFormDialogTrigger>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <ImportOpmlDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <UploadIcon />
          <span className="truncate">Import OPML</span>
        </SidebarMenuButton>
      </ImportOpmlDialogTrigger>
    </SidebarMenuItem>
    <SidebarMenuItem>
      {/* A plain link: the route handler sets Content-Disposition, so the
          browser downloads rather than navigates. No client state needed. */}
      <SidebarMenuButton asChild>
        <a href="/api/opml" download="briefing-officer.opml">
          <DownloadIcon />
          <span className="truncate">Export OPML</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </>
);

export default AddNavActions;
```

- [ ] **Step 5: Run the component test to verify it passes**

Run:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npx vitest run --project components tests/components/navigation/import-opml-dialog-trigger.test.tsx`

Expected: PASS, 5 tests.

- [ ] **Step 6: Lint, typecheck, build, commit**

```bash
npx prettier --write src/components/navigation/import-opml-dialog-trigger.tsx src/components/navigation/add-nav-actions.tsx tests/components/navigation/import-opml-dialog-trigger.test.tsx
npm run lint && npm run typecheck && npm run build
git add src/components/navigation/import-opml-dialog-trigger.tsx src/components/navigation/add-nav-actions.tsx tests/components/navigation/import-opml-dialog-trigger.test.tsx
git commit -m "feat: add Import OPML and Export OPML to the sidebar

Import opens a dialog that takes a file and reports what was added,
skipped, and could not be used. Export downloads the feed list.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016JBYhTACTZPTGGS96R6EHG"
```

---

### Task 5: Documentation

**Files:**

- Modify: `docs/prd.md`
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Update the PRD**

In `docs/prd.md`:

1. Under "Non-goals (as of this version)", delete the line
   `- Importing or exporting feed lists (no OPML support).`
2. In "4. Key features (as built)", extend item 1 so it reads:

   ```markdown
   1. **Feed reading.** Subscribe to RSS and Atom feeds by URL, group them into
      categories, pause and resume automatic refresh per feed, and refresh a
      feed, a category, or everything on demand. The sidebar shows unread counts
      per feed. The feed list can be exported as OPML and imported from an OPML
      file written by another reader, with categories carried over as folders.
   ```

3. In "5. Key flows", add after "Adding a feed":

   ```markdown
   - **Moving in from another reader.** Export an OPML file there, choose
     "Import OPML" in the sidebar, pick the file. Folders become categories,
     feeds already subscribed are skipped, and the new feeds are fetched in the
     background. A summary says what was added and what could not be used.
   ```

4. In "7. Open questions and known gaps", delete the line
   `- No OPML import or export. This is a common expectation for a feed reader.`

5. Change the status line at the top to
   `Status: draft, documents the product as built in version 0.15.0 plus OPML import and export. Last updated: 2026-09-13.`

- [ ] **Step 2: Update the README**

In `README.md`, under "## Features", add after the "News reader with RSS and
Atom support." line:

```markdown
- Import and export your feed list as OPML.
```

- [ ] **Step 3: Format and commit**

```bash
npx prettier --write docs/prd.md README.md
git add docs/prd.md README.md
git commit -m "docs: record OPML import and export in the PRD and README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016JBYhTACTZPTGGS96R6EHG"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run every CI gate**

```bash
npm run format:check
npm run lint
npm run typecheck
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes npm run test
npm run build
```

Expected: all pass. If `format:check` fails, run `npm run format` and commit the
result as `style: format`.
