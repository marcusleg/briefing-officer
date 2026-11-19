# Read Chat Answers Aloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A speaker button under every finished `/chat` answer reads it aloud
through the configured speech service, or the browser's voices when none covers
English.

**Architecture:** A pure module turns an answer's Markdown into spoken
sentences. `/api/speech` accepts text without an article and reads it as
English. A `ReadAloud` component under each answer mounts the existing
`useServerSpeech` or `useSpeechSynthesis` hook only while that answer is read;
`Chat` tracks which answer that is.

**Tech Stack:** Next.js 16.4, React 19, AI SDK 7, `unified`/`remark-parse`/
`remark-gfm`/`remark-math`, Vitest with jsdom and Testing Library, sonner.

**Spec:** `docs/superpowers/specs/2026-11-19-chat-read-aloud-design.md`

## Global Constraints

- Work in `/home/marcus/git/github.com/marcusleg/briefing-officer/.claude/worktrees/chat-read-aloud`
  on branch `feat/chat-read-aloud`. Never touch the main checkout.
- Every chat answer is read as English (`DEFAULT_LANGUAGE`, `"en"`).
- Playback rate is always 1.0. Chat never calls `setRate` and never reads the
  audio summary's saved speed.
- `/api/speech` keeps its session check and its 4,096-character cap.
- Toast copy, exactly: `This answer could not be read aloud.`
- Button labels, exactly: `Read aloud` (idle) and `Stop reading` (waiting or
  reading).
- Color only through design tokens, never raw Tailwind palette classes. No
  shadows on flat surfaces.
- Comments describe the code as it is, never its history. American English.
- Next.js APIs differ from older versions: read the relevant guide in
  `node_modules/next/dist/docs/` before changing a route handler or page.
- Commits: Conventional Commits without scopes. Per-task commits use the
  messages given; Task 5 squashes them into one `feat:` commit. Never pass
  `--no-verify`.
- Run tests with `npx vitest run <path>`. The node project covers
  `tests/unit` and `tests/integration`, the components project
  `tests/components` (jsdom).

---

### Task 1: Spoken sentences from Markdown

**Files:**

- Create: `src/lib/chat-speech-text.ts`
- Create: `tests/unit/chatSpeechText.test.ts`
- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**

- Produces: `spokenSentences(markdown: string): string[]` and
  `MAX_SENTENCE_LENGTH = 4096`, both exported from `@/lib/chat-speech-text`.

- [ ] **Step 1: Add the parsers as direct dependencies**

They are already installed through Streamdown; this pins them as our own.

```bash
npm install unified@^11.0.5 remark-parse@^11.0.0 remark-gfm@^4.0.1 remark-math@^6.0.0
npm install --save-dev @types/mdast@^4.0.4
```

Expected: `package.json` lists the four under `dependencies` and
`@types/mdast` under `devDependencies`.

- [ ] **Step 2: Write the failing tests**

`tests/unit/chatSpeechText.test.ts`:

```ts
import { MAX_SENTENCE_LENGTH, spokenSentences } from "@/lib/chat-speech-text";
import { describe, expect, it } from "vitest";

describe("spokenSentences", () => {
  it("splits a paragraph into sentences", () => {
    expect(spokenSentences("Alphabet rose 4%. Analysts expected less.")).toEqual(
      ["Alphabet rose 4%.", "Analysts expected less."],
    );
  });

  it("keeps headings and list items without periods as their own sentences", () => {
    expect(
      spokenSentences("## Results\n\n- Revenue grew\n- Costs fell"),
    ).toEqual(["Results", "Revenue grew", "Costs fell"]);
  });

  it("reads links as their text, never their URL", () => {
    expect(
      spokenSentences(
        "[Alphabet beats estimates](/feed/1/article/2/text-summary) reported growth.",
      ),
    ).toEqual(["Alphabet beats estimates reported growth."]);
  });

  it("reads emphasis and inline code as plain text", () => {
    expect(spokenSentences("It is **very** _fast_ and uses `gpt`.")).toEqual([
      "It is very fast and uses gpt.",
    ]);
  });

  it("skips code blocks, images, HTML and math", () => {
    expect(
      spokenSentences(
        [
          "Before.",
          "```js\nconst x = 1;\n```",
          "See ![chart](https://evil.example/x.png) this.",
          "<div>hidden</div>",
          "The ratio $x^2$ grew.",
          "$$\nx = 1\n$$",
          "After.",
        ].join("\n\n"),
      ),
    ).toEqual(["Before.", "See this.", "The ratio grew.", "After."]);
  });

  it("skips footnote references and definitions", () => {
    expect(
      spokenSentences("Growth was strong.[^1]\n\n[^1]: Source article."),
    ).toEqual(["Growth was strong."]);
  });

  it("skips list items that are only links", () => {
    expect(
      spokenSentences(
        [
          "Growth was strong.",
          "Sources:",
          "- [Alphabet beats estimates](/feed/1/article/2/text-summary)\n- [Cloud grows](/feed/1/article/3/text-summary).",
        ].join("\n\n"),
      ),
    ).toEqual(["Growth was strong.", "Sources:"]);
  });

  it("keeps list items that say more than a link", () => {
    expect(
      spokenSentences("- [Alphabet](/feed/1/article/2/text-summary) grew"),
    ).toEqual(["Alphabet grew"]);
  });

  it("reads table cells one by one", () => {
    expect(
      spokenSentences(
        "| Company | Change |\n| --- | --- |\n| Alphabet | +4% |",
      ),
    ).toEqual(["Company", "Change", "Alphabet", "+4%"]);
  });

  it("collapses whitespace inside a block", () => {
    expect(spokenSentences("One\nline   continues.")).toEqual([
      "One line continues.",
    ]);
  });

  it("splits a sentence over the limit at whitespace", () => {
    const sentence = "word ".repeat(1000).trim();

    const pieces = spokenSentences(sentence);

    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(MAX_SENTENCE_LENGTH);
    }
    expect(pieces.join(" ")).toBe(sentence);
  });

  it("splits a sentence over the limit without whitespace at the limit", () => {
    expect(spokenSentences("a".repeat(5000))).toEqual([
      "a".repeat(MAX_SENTENCE_LENGTH),
      "a".repeat(5000 - MAX_SENTENCE_LENGTH),
    ]);
  });

  it("returns nothing when there is nothing to read", () => {
    expect(spokenSentences("")).toEqual([]);
    expect(spokenSentences("```\ncode\n```")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/chatSpeechText.test.ts`
Expected: FAIL, cannot resolve `@/lib/chat-speech-text`.

- [ ] **Step 4: Implement**

`src/lib/chat-speech-text.ts`:

```ts
import type { ListItem, Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** The longest text /api/speech synthesizes in one request. */
export const MAX_SENTENCE_LENGTH = 4096;

// The syntax Streamdown renders answers with, so the spoken text follows what
// the reader sees.
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/** Nodes that are not prose: read aloud they would be noise. */
const SKIPPED = new Set([
  "code",
  "definition",
  "footnoteDefinition",
  "footnoteReference",
  "html",
  "image",
  "imageReference",
  "inlineMath",
  "math",
]);

/** Nodes whose text is read as one block, split into sentences afterwards. */
const BLOCKS = new Set(["heading", "paragraph", "tableCell"]);

const PUNCTUATION_ONLY = /^[\s\p{P}]*$/u;

const inlineText = (node: Nodes): string => {
  if (SKIPPED.has(node.type)) return "";
  if (node.type === "break") return " ";
  if ("value" in node) return node.value;
  if ("children" in node) {
    return (node.children as Nodes[]).map(inlineText).join("");
  }
  return "";
};

/**
 * Answers end with a list of their sources, whose items are only a link to an
 * article. Read aloud, such a list is a string of headlines.
 */
const isCitation = (item: ListItem) => {
  const [only, ...rest] = item.children;
  if (rest.length > 0 || only?.type !== "paragraph") return false;

  return (
    only.children.some((child) => child.type === "link") &&
    only.children.every(
      (child) =>
        child.type === "link" ||
        (child.type === "text" && PUNCTUATION_ONLY.test(child.value)),
    )
  );
};

const collectBlocks = (node: Nodes, blocks: string[]) => {
  if (SKIPPED.has(node.type)) return;
  if (node.type === "listItem" && isCitation(node)) return;
  if (BLOCKS.has(node.type)) {
    blocks.push(inlineText(node));
    return;
  }
  if ("children" in node) {
    for (const child of node.children as Nodes[]) collectBlocks(child, blocks);
  }
};

/** Breaks text longer than the route accepts at the last space that fits. */
const capLength = (sentence: string): string[] => {
  const pieces: string[] = [];
  let rest = sentence;

  while (rest.length > MAX_SENTENCE_LENGTH) {
    const space = rest.lastIndexOf(" ", MAX_SENTENCE_LENGTH);
    const cut = space > 0 ? space : MAX_SENTENCE_LENGTH;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) pieces.push(rest);
  return pieces;
};

/**
 * The sentences to read aloud from a chat answer's Markdown.
 *
 * Each paragraph, heading, list item and table cell is split on its own, so a
 * heading or list item without a final period is still its own sentence.
 * Answers are read as English, so the segmenter's rules are English ones.
 */
export const spokenSentences = (markdown: string): string[] => {
  const blocks: string[] = [];
  collectBlocks(parser.parse(markdown), blocks);

  return blocks
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block !== "")
    .flatMap((block) =>
      Array.from(segmenter.segment(block), ({ segment }) => segment.trim()),
    )
    .filter((sentence) => sentence !== "")
    .flatMap(capLength);
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/chatSpeechText.test.ts`
Expected: PASS, 13 tests.

If a case fails because the parser shapes a construct differently than
assumed (for example a footnote or math node), inspect it with
`node -e` on `unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(...)`
and adjust `SKIPPED`/`BLOCKS`, not the expected output.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add package.json package-lock.json src/lib/chat-speech-text.ts tests/unit/chatSpeechText.test.ts
git commit -m "feat: turn chat answers into spoken sentences"
```

---

### Task 2: Speech without an article

**Files:**

- Modify: `src/app/api/speech/route.ts`
- Modify: `src/lib/server-speech-queue.ts` (constructor and field type only)
- Modify: `src/hooks/use-server-speech.ts`
- Modify: `tests/helpers/server-speech.ts` (`FakeSpeechRequest.articleId`)
- Test: `tests/integration/speechRoute.test.ts`,
  `tests/components/hooks/use-server-speech.test.tsx`

**Interfaces:**

- Produces: `POST /api/speech` accepts `{ text }` (no `articleId`) and reads it
  in `DEFAULT_LANGUAGE`; `new ServerSpeechQueue(articleId?: number)`;
  `useServerSpeech(articleId?: number): SpeechControls`.

- [ ] **Step 1: Read the route handler guide**

Skim `node_modules/next/dist/docs/` for the route handler page (find it with
`grep -ril "route handler" node_modules/next/dist/docs | head`). The handler's
signature does not change; confirm nothing in it is deprecated.

- [ ] **Step 2: Write the failing route tests**

In `tests/integration/speechRoute.test.ts`, add inside `describe("POST /api/speech")`
after the "picks the voice from the article's language" test:

```ts
  it("reads text without an article as English", async () => {
    const response = await POST(speechRequest({ text: "Hello." }));

    expect(response.status).toBe(200);
    expect(getSpeechModelFor).toHaveBeenCalledWith(null);
    expect(generateSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Hello." }),
    );
  });

  it("returns 422 for text without an article when no voice covers English", async () => {
    vi.mocked(getSpeechModelFor).mockReturnValue(undefined);

    const response = await POST(speechRequest({ text: "Hello." }));

    expect(response.status).toBe(422);
    expect(generateSpeech).not.toHaveBeenCalled();
  });
```

and add to the `it.each` table of 400 cases:

```ts
    {
      name: "null article id",
      body: () => ({ articleId: null, text: "Hi." }),
    },
```

- [ ] **Step 3: Write the failing hook test**

In `tests/components/hooks/use-server-speech.test.tsx`, add inside
`describe("useServerSpeech")`:

```ts
  it("sends no article id when it reads text without an article", () => {
    const speech = installServerSpeech();
    const { result } = renderHook(() => useServerSpeech());

    act(() => {
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });

    const init = speech.fetch.mock.calls[0][1];
    expect(JSON.parse(init.body as string)).toEqual({ text: "One." });
  });
```

In `tests/helpers/server-speech.ts`, change `FakeSpeechRequest.articleId` and
the parsed body type to optional:

```ts
export interface FakeSpeechRequest {
  articleId?: number;
```

```ts
        const body = JSON.parse(init.body as string) as {
          articleId?: number;
          text: string;
        };
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run tests/integration/speechRoute.test.ts tests/components/hooks/use-server-speech.test.tsx`
Expected: the two new route tests FAIL with status 400; the hook test fails
typecheck-wise only (`useServerSpeech()` needs an argument) but may pass at
runtime because `JSON.stringify` drops `undefined`. That is fine; Step 6 fixes
the types.

- [ ] **Step 5: Change the route**

In `src/app/api/speech/route.ts`:

Replace the comment above `MAX_TEXT_LENGTH` with:

```ts
// Briefing and chat sentences are far shorter. The cap bounds what one request
// can make the speech service do, and is large enough that a script that
// arrived without line breaks can still be read as one clip. It matches the
// input limit of OpenAI's TTS API.
```

Replace `parseBody` with:

```ts
const isArticleId = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= MAX_ARTICLE_ID;

/**
 * An absent `articleId` means text that belongs to no article, such as a chat
 * answer. One that is present must be valid.
 */
const parseBody = async (
  request: Request,
): Promise<{ articleId: number | undefined; text: string } | null> => {
  const body = (await request.json().catch(() => null)) as {
    articleId?: unknown;
    text?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (text === "" || text.length > MAX_TEXT_LENGTH) {
    return null;
  }

  const articleId = body?.articleId;
  if (articleId === undefined) {
    return { articleId: undefined, text };
  }

  return isArticleId(articleId) ? { articleId, text } : null;
};
```

Replace the doc comment on `POST` and the block from
`const article = await prisma.article.findUnique(` through the 422 return with:

```ts
/**
 * Synthesizes one sentence as mp3: of an article's audio briefing, or of text
 * that belongs to no article, such as a chat answer.
 */
```

```ts
  // The language comes from the stored article, never from the client, so a
  // voice only ever reads the languages it was configured for. Text without
  // an article is read as English: getSpeechModelFor resolves null to the
  // default language.
  let language: string | null = null;
  if (body.articleId !== undefined) {
    const article = await prisma.article.findUnique({
      where: { id: body.articleId, userId: session.user.id },
      select: { language: true },
    });
    if (!article) {
      return textResponse("Article not found.", 404);
    }
    language = article.language;
  }

  const speech = getSpeechModelFor(language);
  if (!speech) {
    return textResponse(
      "No speech voice is configured for this language.",
      422,
    );
  }
```

The failure log keeps `{ err: error, articleId: body.articleId }`; pino drops
an undefined field.

- [ ] **Step 6: Make the article id optional on the client**

In `src/lib/server-speech-queue.ts`:

```ts
  private readonly articleId: number | undefined;
```

```ts
  /** Without an article id, the text is read as English. */
  constructor(articleId?: number) {
    this.articleId = articleId;
  }
```

The request body needs no change: `JSON.stringify` leaves out an undefined
`articleId`.

In `src/hooks/use-server-speech.ts`, replace the doc comment and signature:

```ts
/**
 * Reads text through the TTS service behind /api/speech: an article's
 * briefing, or, without an article id, English text such as a chat answer.
 *
 * The queue is bound to the article it was created for. Each instance owns its
 * own <audio> element, so the overlap a client-side navigation creates needs no
 * coordination between pages.
 */
export function useServerSpeech(articleId?: number): SpeechControls {
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/integration/speechRoute.test.ts tests/components/hooks/use-server-speech.test.tsx tests/components/article/audio-summary-player.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/speech/route.ts src/lib/server-speech-queue.ts src/hooks/use-server-speech.ts tests/helpers/server-speech.ts tests/integration/speechRoute.test.ts tests/components/hooks/use-server-speech.test.tsx
git commit -m "feat: synthesize speech for text without an article"
```

---

### Task 3: The ReadAloud component

**Files:**

- Create: `src/components/chat/read-aloud.tsx`
- Create: `tests/components/chat/read-aloud.test.tsx`

**Interfaces:**

- Consumes: `spokenSentences` (Task 1); `useServerSpeech()` without an id
  (Task 2); `useSpeechSynthesis(null)` from `@/hooks/use-speech-synthesis`;
  `MessageAction`, `MessageActions` from `@/components/ai-elements/message`;
  `Spinner` from `@/components/ui/spinner`.
- Produces, from `@/components/chat/read-aloud`:

  ```ts
  export type SpeechEngine = "browser" | "server";
  export const ReadAloud: (props: {
    engine: SpeechEngine;
    text: string; // the answer's Markdown
    reading: boolean;
    onRead: () => void;
    onReadEnd: () => void;
  }) => JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing tests**

`tests/components/chat/read-aloud.test.tsx`:

```tsx
import { ReadAloud, type SpeechEngine } from "@/components/chat/read-aloud";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installServerSpeech } from "../../helpers/server-speech";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const ANSWER = "Alphabet rose. Analysts expected less.";

/** Holds the reading state the way Chat does, for a single answer. */
const Harness = ({
  engine,
  text = ANSWER,
}: {
  engine: SpeechEngine;
  text?: string;
}) => {
  const [reading, setReading] = useState(false);
  return (
    <ReadAloud
      engine={engine}
      text={text}
      reading={reading}
      onRead={() => setReading(true)}
      onReadEnd={() => setReading(false)}
    />
  );
};

/** Lets the fetch → blob → object URL chain run to completion. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const readAloud = () => screen.getByRole("button", { name: "Read aloud" });
const stopReading = () => screen.getByRole("button", { name: "Stop reading" });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("ReadAloud with the speech service", () => {
  it("reads the answer and stops on a second click", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());

    expect(speech.requested()).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);
    expect(speech.requests[0]).not.toHaveProperty("articleId");
    expect(screen.getByRole("status")).toBeInTheDocument();

    speech.requests[0].respond();
    await settle();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(stopReading());

    expect(readAloud()).toBeInTheDocument();
    expect(speech.requests[1].signal.aborted).toBe(true);
  });

  it("returns to idle once the answer has been read", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    speech.requests[0].respond();
    speech.requests[1].respond();
    await settle();
    act(() => speech.audio().finish());
    await settle();
    expect(stopReading()).toBeInTheDocument();
    act(() => speech.audio().finish());
    await settle();

    expect(readAloud()).toBeInTheDocument();
  });

  it("queues the sentences once under Strict Mode", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Harness engine="server" />
      </StrictMode>,
    );

    await user.click(readAloud());
    const live = () => speech.requests.filter((r) => !r.signal.aborted);
    expect(live().map((r) => r.text)).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);

    for (const request of live()) request.respond();
    await settle();
    act(() => speech.audio().finish());
    await settle();
    act(() => speech.audio().finish());
    await settle();

    expect(readAloud()).toBeInTheDocument();
  });

  it("shows a toast and returns to idle when a clip fails", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    speech.requests[0].fail();
    await settle();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "This answer could not be read aloud.",
      expect.anything(),
    );
    expect(readAloud()).toBeInTheDocument();
  });

  it("renders nothing when the answer has nothing to read", () => {
    installServerSpeech();
    render(<Harness engine="server" text={"```\ncode\n```"} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ReadAloud with the browser's voices", () => {
  it("renders nothing without speechSynthesis", () => {
    render(<Harness engine="browser" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads the answer, stops on a second click and ends with the last sentence", async () => {
    const engine = installSpeechEngine();
    const user = userEvent.setup();
    render(<Harness engine="browser" />);

    await user.click(readAloud());
    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);
    expect(engine.spoken()[0].lang).toBe("en");

    await user.click(stopReading());
    // cancel() empties the engine's queue; playFrom also cancels, so the call
    // alone would prove nothing.
    expect(engine.spoken()).toEqual([]);
    expect(readAloud()).toBeInTheDocument();

    await user.click(readAloud());
    act(() => engine.spoken().at(-1)!.onend!());
    expect(readAloud()).toBeInTheDocument();
  });

  it("shows a toast instead of reading in a browser with no voices", async () => {
    const engine = installSpeechEngine([]);
    const user = userEvent.setup();
    render(<Harness engine="browser" />);

    await user.click(readAloud());

    expect(toast.error).toHaveBeenCalledWith(
      "This answer could not be read aloud.",
      expect.anything(),
    );
    expect(engine.speak).not.toHaveBeenCalled();
    expect(readAloud()).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/chat/read-aloud.test.tsx`
Expected: FAIL, cannot resolve `@/components/chat/read-aloud`.

- [ ] **Step 3: Implement**

`src/components/chat/read-aloud.tsx`:

```tsx
"use client";

import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";
import { Spinner } from "@/components/ui/spinner";
import type { SpeechControls } from "@/hooks/speech-controls";
import { useServerSpeech } from "@/hooks/use-server-speech";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { spokenSentences } from "@/lib/chat-speech-text";
import { SquareIcon, Volume2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

export type SpeechEngine = "browser" | "server";

const reportFailure = () =>
  toast.error("This answer could not be read aloud.", {
    id: "chat-read-aloud",
  });

// Whether the browser has the Web Speech API never changes, so nothing is
// subscribed to. The server snapshot leaves the button out of the server render
// and the first client render alike.
const subscribeToNothing = () => () => {};
const hasSpeechSynthesis = () => "speechSynthesis" in window;
const onTheServer = () => false;

interface ChatSpeechProps {
  sentences: string[];
  onReadEnd: () => void;
}

/**
 * Reads the sentences from the first and shows the stop button meanwhile.
 * Mounted only while its answer is read; unmounting stops playback, because
 * both engines' hooks stop when they unmount.
 */
const ChatSpeech = ({
  speech,
  sentences,
  onReadEnd,
}: ChatSpeechProps & { speech: SpeechControls }) => {
  const { buffering, enqueue, error, playFrom, speaking } = speech;
  // Strict Mode remounts with the hook's sentences retained, so the replay only
  // restarts playback instead of queuing every sentence a second time.
  const queued = useRef(false);
  // Playback is idle before it starts, which is not the same as having ended.
  const started = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    if (!queued.current) {
      queued.current = true;
      sentences.forEach(enqueue);
    }
    playFrom(0);
  }, [sentences, enqueue, playFrom]);

  useEffect(() => {
    if (ended.current) return;

    if (error) {
      ended.current = true;
      reportFailure();
      onReadEnd();
    } else if (speaking) {
      started.current = true;
    } else if (started.current) {
      ended.current = true;
      onReadEnd();
    }
  }, [error, speaking, onReadEnd]);

  return (
    <MessageAction
      label="Stop reading"
      aria-label="Stop reading"
      onClick={onReadEnd}
    >
      {buffering ? <Spinner /> : <SquareIcon />}
    </MessageAction>
  );
};

// One component per engine, so only the selected engine's hook mounts. An idle
// browser hook would otherwise take speechSynthesis from another page.
const ServerChatSpeech = (props: ChatSpeechProps) => {
  const speech = useServerSpeech();
  return <ChatSpeech {...props} speech={speech} />;
};

const BrowserChatSpeech = (props: ChatSpeechProps) => {
  const speech = useSpeechSynthesis(null);
  return <ChatSpeech {...props} speech={speech} />;
};

interface ReadAloudProps {
  engine: SpeechEngine;
  /** The answer's Markdown. */
  text: string;
  /** Whether this answer is the one being read. */
  reading: boolean;
  onRead: () => void;
  onReadEnd: () => void;
}

/** The button that reads a chat answer aloud, at 1.0x and as English. */
export const ReadAloud = ({
  engine,
  text,
  reading,
  onRead,
  onReadEnd,
}: ReadAloudProps) => {
  const browserCanSpeak = useSyncExternalStore(
    subscribeToNothing,
    hasSpeechSynthesis,
    onTheServer,
  );
  const sentences = useMemo(() => spokenSentences(text), [text]);

  if (sentences.length === 0 || (engine === "browser" && !browserCanSpeak)) {
    return null;
  }

  const read = () => {
    // A browser without voices, such as Linux without speech-dispatcher,
    // accepts utterances but never plays or ends them.
    if (engine === "browser" && window.speechSynthesis.getVoices().length === 0) {
      reportFailure();
      return;
    }
    onRead();
  };

  return (
    <MessageActions>
      {!reading ? (
        <MessageAction label="Read aloud" aria-label="Read aloud" onClick={read}>
          <Volume2Icon />
        </MessageAction>
      ) : engine === "server" ? (
        <ServerChatSpeech sentences={sentences} onReadEnd={onReadEnd} />
      ) : (
        <BrowserChatSpeech sentences={sentences} onReadEnd={onReadEnd} />
      )}
    </MessageActions>
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/chat/read-aloud.test.tsx`
Expected: PASS, 8 tests.

If the Strict Mode test fails, check the effect ordering: a child's effects
run before its parent's, so `ChatSpeech` calls `playFrom(0)` before the hook's
own effects. That is the same order as the audio summary player and must keep
working; fix the component, not the test.

- [ ] **Step 5: Lint, typecheck and commit**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

```bash
git add src/components/chat/read-aloud.tsx tests/components/chat/read-aloud.test.tsx
git commit -m "feat: add a read aloud button for chat answers"
```

---

### Task 4: Wire it into the chat page

**Files:**

- Modify: `src/components/chat/chat-message.tsx`
- Modify: `src/components/chat/chat.tsx`
- Modify: `src/app/chat/page.tsx`
- Modify: `README.md`
- Test: `tests/components/chat/chat-message.test.tsx`,
  `tests/components/chat/chat.test.tsx`

**Interfaces:**

- Consumes: `ReadAloud`, `SpeechEngine` (Task 3); `getSpeechModelFor` from
  `@/lib/ai/speechRegistry`.
- Produces: `ChatMessage` takes `actions?: ReactNode`;
  `messageText(message: ChatUIMessage): string` exported from
  `@/components/chat/chat-message`; `Chat` takes
  `{ speechEngine: SpeechEngine }`.

- [ ] **Step 1: Write the failing ChatMessage tests**

In `tests/components/chat/chat-message.test.tsx`, change the import to
`import ChatMessage, { messageText } from "@/components/chat/chat-message";`
and add at the end of the file:

```tsx
describe("ChatMessage actions", () => {
  const answer = assistant([{ type: "text", text: "Hello." }]);

  it("shows the actions under a finished answer", () => {
    render(<ChatMessage message={answer} actions={<button>Act</button>} />);

    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("hides the actions while the answer is being written", () => {
    render(
      <ChatMessage message={answer} answering actions={<button>Act</button>} />,
    );

    expect(
      screen.queryByRole("button", { name: "Act" }),
    ).not.toBeInTheDocument();
  });
});

describe("messageText", () => {
  it("joins the text parts like paragraphs and leaves out tool calls", () => {
    expect(
      messageText(
        assistant([
          { type: "text", text: "First." },
          searchPart("output-available"),
          { type: "text", text: "Second." },
        ]),
      ),
    ).toBe("First.\n\nSecond.");
  });
});
```

If `describe` is not yet imported in that file, add it to the `vitest` import.
`searchPart` is the file's existing helper; if its signature differs from
`searchPart(state)`, use any existing tool-part fixture from the file instead.

- [ ] **Step 2: Write the failing Chat tests**

In `tests/components/chat/chat.test.tsx`:

1. Every `render(<Chat />)` and `rerender(<Chat />)` becomes
   `render(<Chat speechEngine="server" />)` / `rerender(<Chat speechEngine="server" />)`:

   ```bash
   sed -i 's|<Chat />|<Chat speechEngine="server" />|g' tests/components/chat/chat.test.tsx
   ```

2. Add `import { installServerSpeech } from "../../helpers/server-speech";`
   and, if missing, `afterEach(() => vi.unstubAllGlobals());` at the top
   level. Keep the existing `URL.createObjectURL` setup; `installServerSpeech`
   stubs `URL` itself in the tests that call it.

3. Add inside `describe("Chat")`:

```tsx
  const twoExchanges = [
    ...oneExchange,
    { id: "u2", role: "user", parts: [{ type: "text", text: "More?" }] },
    {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "Goodbye." }],
    },
  ];

  it("reads one answer at a time", async () => {
    const speech = installServerSpeech();
    mockChat({ messages: twoExchanges });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    const [first, second] = screen.getAllByRole("button", {
      name: "Read aloud",
    });
    await user.click(first);
    expect(speech.requested()).toEqual(["Hello"]);

    await user.click(second);

    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(speech.requested()).toEqual(["Hello", "Goodbye."]);
    expect(
      screen.getAllByRole("button", { name: "Stop reading" }),
    ).toHaveLength(1);
  });

  it("stops reading on New chat", async () => {
    const speech = installServerSpeech();
    mockChat({ messages: oneExchange });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Stop reading" }),
    ).not.toBeInTheDocument();
  });

  it("offers no read aloud while the answer is being written", () => {
    mockChat({ messages: oneExchange, status: "streaming" });
    render(<Chat speechEngine="server" />);

    expect(
      screen.queryByRole("button", { name: "Read aloud" }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/components/chat`
Expected: the new ChatMessage, messageText and Chat tests FAIL; the
`read-aloud` tests still pass.

- [ ] **Step 4: Add `actions` and `messageText` to ChatMessage**

In `src/components/chat/chat-message.tsx`, add `import type { ReactNode } from "react";`
and, above `const ChatMessage`:

```tsx
/** An answer's text, its parts separated like paragraphs. */
export const messageText = (message: ChatUIMessage) =>
  message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");
```

Change the props and the assistant branch:

```tsx
const ChatMessage = ({
  message,
  answering = false,
  actions,
}: {
  message: ChatUIMessage;
  /** Whether this answer is still being written. */
  answering?: boolean;
  /** Controls shown under the answer once it has been written. */
  actions?: ReactNode;
}) => {
```

```tsx
  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        {toolParts.length > 0 && (
          <ToolActivity parts={toolParts} answering={answering} />
        )}
        {message.parts.map((part, index) =>
          part.type === "text" ? (
            <SafeMarkdown key={index} className="text-prose">
              {part.text}
            </SafeMarkdown>
          ) : null,
        )}
      </MessageContent>
      {!answering && actions}
    </Message>
  );
```

The user branch is unchanged and ignores `actions`.

- [ ] **Step 5: Track the answer being read in Chat**

In `src/components/chat/chat.tsx`:

- Imports: `import ChatMessage, { messageText } from "@/components/chat/chat-message";`,
  `import { ReadAloud, type SpeechEngine } from "@/components/chat/read-aloud";`,
  and `import { useCallback, useState } from "react";` (keep the existing type
  import from `react`).
- Signature: `const Chat = ({ speechEngine }: { speechEngine: SpeechEngine }) => {`
- After the `useChat` destructuring:

```tsx
  // The answer being read aloud. Only one is read at a time: reading another
  // replaces it, and the one it replaces stops as its player unmounts.
  const [readingId, setReadingId] = useState<string | undefined>(undefined);
  const stopReading = useCallback(() => setReadingId(undefined), []);
```

- In `startOver`, add `setReadingId(undefined);` after `setMessages([]);`.
- Replace the `messages.map` render with:

```tsx
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              answering={busy && index === messages.length - 1}
              actions={
                <ReadAloud
                  engine={speechEngine}
                  text={messageText(message)}
                  reading={message.id === readingId}
                  onRead={() => setReadingId(message.id)}
                  onReadEnd={stopReading}
                />
              }
            />
          ))}
```

- [ ] **Step 6: Pick the engine on the chat page**

Read `node_modules/next/dist/docs/` for server components/pages if unsure; the
page is already an async server component. In `src/app/chat/page.tsx`, add
`import { getSpeechModelFor } from "@/lib/ai/speechRegistry";` and replace
`<Chat />` with:

```tsx
      <Chat
        // A configured voice for English reads answers aloud; otherwise the
        // browser's own voices do.
        speechEngine={getSpeechModelFor(null) ? "server" : "browser"}
      />
```

- [ ] **Step 7: Document it in the README**

In `README.md`, replace the chat feature bullet with:

```markdown
- Chat with your articles: ask questions in plain language and get answers drawn
  only from your own feeds, with links to the articles they come from. Answers
  can be read aloud.
```

and the first paragraph under `### Text-to-Speech` with:

```markdown
Optional. Audio summaries are read by an OpenAI-compatible speech API when one
is configured for the article's language, and by the browser's own voices
otherwise. Chat answers are read as English, by the speech API when `en` is
among its languages. The service is used only when both `OPENAI_TTS_MODEL` and
`OPENAI_TTS_VOICE` are set.
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/components/chat`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/chat/chat-message.tsx src/components/chat/chat.tsx src/app/chat/page.tsx README.md tests/components/chat/chat-message.test.tsx tests/components/chat/chat.test.tsx
git commit -m "feat: read chat answers aloud"
```

---

### Task 5: Verify and squash

**Files:** none new.

- [ ] **Step 1: Run everything CI gates on**

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all pass. Fix failures in the code, never by skipping a check.
`npm run format` fixes formatting.

- [ ] **Step 2: Try it in the running app**

Follow the smoke-test recipe in the project memory
(`project-briefing-officer-dev-quirks`): start the dev server, sign in, ask a
question on `/chat`, click "Read aloud" on the answer and confirm it is read
and the button returns to idle; click it again and stop midway. Check the
browser engine too by starting without `OPENAI_TTS_MODEL`.

- [ ] **Step 3: Squash the implementation into one commit**

The four task commits become one changelog entry. The spec and plan commits
stay as they are.

```bash
git log --oneline main..HEAD
```

Note the hash of the plan commit (`docs: plan reading chat answers aloud`),
then:

```bash
git reset --soft <plan-commit-hash>
git commit -F - <<'EOF'
feat: read chat answers aloud

Every finished answer on /chat has a Read aloud button. It reads the answer
through the configured speech service when its languages include English, and
through the browser's own voices otherwise. Answers are always read as English,
at 1.0x.

- spokenSentences parses the answer's Markdown with the parsers Streamdown
  uses and splits each paragraph, heading, list item and table cell into
  sentences with Intl.Segmenter. Links are read as their text; code, math,
  images, HTML, footnotes and link-only list items (the sources list) are
  skipped. Sentences over 4,096 characters are broken at a space.
- POST /api/speech accepts text without an articleId and reads it in the
  default language. A present articleId must still be valid and owned.
- ReadAloud mounts the selected engine's hook only while its answer is read,
  so stopping, reading another answer and New chat all stop playback by
  unmounting it. A failed clip, or a browser without voices, shows a toast.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

Run `git log --oneline main..HEAD`; expected three commits: the design spec,
the plan, and `feat: read chat answers aloud`.
