# Read-Aloud Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an icon-only button to the article card that reads the article's
title and AI-generated lead aloud using the browser's built-in speech synthesis.

**Architecture:** A `useSpeechSynthesis` hook wraps the Web Speech API and
absorbs its three quirks (async voice loading, Chrome's ~15s utterance cutoff,
cleanup on unmount). A presentational `ReadAloudButton` consumes the hook and
renders nothing when the browser has no speech engine. The text to speak lives
in `ArticleCard`'s client state, so it is threaded down through
`ArticleCardActions` as a new prop.

**Tech Stack:** Next.js 16 (client components), React 19, TypeScript, Web Speech
API (`window.speechSynthesis`), Vitest + Testing Library (`components` project),
shadcn/ui Button + Tooltip, lucide-react icons.

## Global Constraints

- **No new dependencies.** The Web Speech API is a browser built-in. Do not add
  a package.
- **No database or Prisma changes.** The `Article` model has no language field;
  utterance language stays at the browser default.
- **Hooks live in `src/hooks/`** with kebab-case filenames (`use-mobile.ts`,
  `use-date-formatters.ts`). Not `src/lib/hooks/`.
- **Article components live in `src/components/article/`**, kebab-case
  filenames, `export default` at the bottom.
- **Component tests live in
  `tests/components/**/\*.test.tsx`** and run under the `components`Vitest project (jsdom,`globals:
  true`).
- **Commit with explicit paths only — never `git add -A` or `git add .`.** The
  working tree has unrelated in-flight changes (see below).
- Prettier runs `organize-imports` and `tailwindcss` plugins via lint-staged, so
  import order and class order are normalised on commit.

## ⚠️ Pre-existing uncommitted work

Before starting, `git status` shows unrelated in-flight changes for an "article
author" feature:

```
M prisma/schema.prisma
M src/app/feed/[feedId]/article/[articleId]/ai-summary/page.tsx
M src/components/article/article-card.tsx
M src/lib/repository/feedRepository.ts
M src/lib/scraper.ts
M tests/integration/feedRepository.test.ts
M tests/unit/scraper.test.ts
?? prisma/migrations/20260804120000_add_author_to_article/
```

**`src/components/article/article-card.tsx` is modified by that work** (it
changes `ArticleMeta` to use `props.article.author`), and Task 5 of this plan
also modifies that file. Committing the file wholesale would sweep the author
change into this feature's commit.

**Do not attempt to separate them yourself.** Task 5 commits `article-card.tsx`
including the pre-existing author change and says so in the commit message. If
that is not acceptable, stop and ask the user before committing.

---

## File Map

| Action | File                                                   | Responsibility                                        |
| ------ | ------------------------------------------------------ | ----------------------------------------------------- |
| Create | `tests/helpers/speech-synthesis.ts`                    | Shared fake speech engine for both test files         |
| Create | `src/hooks/use-speech-synthesis.ts`                    | Wraps the Web Speech API; owns all browser quirks     |
| Create | `tests/components/hooks/use-speech-synthesis.test.tsx` | Hook behaviour: support detection, keepalive, cleanup |
| Create | `src/components/article/read-aloud-button.tsx`         | Icon-only toggle button + tooltip                     |
| Create | `tests/components/article/read-aloud-button.test.tsx`  | Button behaviour: speaks, stops, hides when unusable  |
| Modify | `src/components/article/article-card-actions.tsx`      | Renders the button in the mobile and desktop rows     |
| Modify | `src/components/article/article-card.tsx:144`          | Passes the lead text down                             |

### Why the text is threaded through as a prop

`ArticleCardActions` receives an article typed
`Prisma.ArticleGetPayload<{ include: { feed: true; scrape: true } }>` — it has
no `lead` relation. The lead is client state in `article-card.tsx:36`
(`aiLead`), populated asynchronously by the effect at line 38. `ArticleCard` is
therefore the only component that has the text, so it must pass it down. A
consequence worth knowing: the button appears only once the lead has loaded,
which is correct — before that there is nothing to read.

---

### Task 1: Create feature branch

- [ ] **Step 1: Create and switch to a new branch**

```bash
git checkout -b feat/read-aloud-button
```

Expected: `Switched to a new branch 'feat/read-aloud-button'`

The uncommitted changes described above come along with the branch. That is fine
and expected.

---

### Task 2: `useSpeechSynthesis` hook

**Files:**

- Create: `tests/helpers/speech-synthesis.ts`
- Create: `src/hooks/use-speech-synthesis.ts`
- Test: `tests/components/hooks/use-speech-synthesis.test.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  `useSpeechSynthesis(): { speak: (text: string) => void; cancel: () => void; speaking: boolean; supported: boolean }`,
  imported from `@/hooks/use-speech-synthesis`. Task 3 depends on exactly these
  four names.
- Produces: `tests/helpers/speech-synthesis.ts` exporting `class FakeUtterance`
  and `installSpeechEngine(voices?: unknown[])`. Task 3's test file imports both
  from `"../../helpers/speech-synthesis"`.

**Background — the three quirks this hook exists to absorb:**

1. **Voices load asynchronously.** Chrome returns `[]` from `getVoices()` until
   it fires a `voiceschanged` event. An empty list therefore means "not loaded
   yet", not "unsupported" — until that event fires.
2. **Chrome and Edge silently truncate utterances at roughly 15 seconds.** An
   article lead of 2–3 sentences runs about 20–25 seconds at default rate, so
   this will happen. The documented workaround is to call `pause()` then
   `resume()` on an interval shorter than the cutoff.
3. **Playback outlives the component.** `speechSynthesis` is a global singleton;
   without a cleanup the audio keeps going after the card unmounts.

- [ ] **Step 1: Write the shared test helper**

Both this task's tests and Task 3's need the same fake speech engine, so it
lives in `tests/helpers/` alongside the existing `db.ts` and `factories.ts`.

Create `tests/helpers/speech-synthesis.ts`:

```ts
import { vi } from "vitest";

/**
 * jsdom implements neither `speechSynthesis` nor `SpeechSynthesisUtterance`,
 * so tests that exercise the Web Speech API install these fakes instead.
 */
export class FakeUtterance {
  text: string;
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

  return speechSynthesis;
};
```

- [ ] **Step 2: Write the failing tests**

Create `tests/components/hooks/use-speech-synthesis.test.tsx`:

```tsx
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeUtterance,
  installSpeechEngine,
} from "../../helpers/speech-synthesis";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSpeechSynthesis", () => {
  it("is unsupported when the browser has no speech engine", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.supported).toBe(false);
  });

  it("becomes supported once voices have loaded", () => {
    const voices: unknown[] = [];
    const speechSynthesis = installSpeechEngine(voices);

    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.supported).toBe(false);

    // Chrome fires voiceschanged once the engine has enumerated its voices.
    voices.push({ name: "Test Voice" });
    const [event, listener] = speechSynthesis.addEventListener.mock.calls[0];
    expect(event).toBe("voiceschanged");
    act(() => listener());

    expect(result.current.supported).toBe(true);
  });

  it("speaks the given text and reports that it is speaking", () => {
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));

    expect(speechSynthesis.speak).toHaveBeenCalledOnce();
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    expect(utterance.text).toBe("Hello world.");
    expect(result.current.speaking).toBe(true);
  });

  it("stops reporting speaking once the utterance ends", () => {
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    act(() => utterance.onend!());

    expect(result.current.speaking).toBe(false);
  });

  it("pings pause/resume so Chrome does not cut off long text", () => {
    vi.useFakeTimers();
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("A lead long enough to be truncated."));
    act(() => void vi.advanceTimersByTime(10_000));

    expect(speechSynthesis.pause).toHaveBeenCalledOnce();
    expect(speechSynthesis.resume).toHaveBeenCalledOnce();
  });

  it("stops the keepalive ping once the utterance ends", () => {
    vi.useFakeTimers();
    const speechSynthesis = installSpeechEngine();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    act(() => utterance.onend!());
    act(() => void vi.advanceTimersByTime(30_000));

    expect(speechSynthesis.pause).not.toHaveBeenCalled();
  });

  it("cancels playback when the component unmounts", () => {
    const speechSynthesis = installSpeechEngine();
    const { result, unmount } = renderHook(() => useSpeechSynthesis());

    act(() => result.current.speak("Hello world."));
    speechSynthesis.cancel.mockClear();
    unmount();

    expect(speechSynthesis.cancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm run test:components -- use-speech-synthesis
```

Expected: FAIL — `Failed to resolve import "@/hooks/use-speech-synthesis"`.

- [ ] **Step 4: Write the hook**

Create `src/hooks/use-speech-synthesis.ts`:

```ts
import * as React from "react";

// Chrome and Edge silently stop an utterance after roughly 15 seconds. Pinging
// pause()/resume() below that threshold keeps longer leads playing to the end.
const KEEPALIVE_INTERVAL_MS = 10_000;

interface SpeechSynthesisControls {
  cancel: () => void;
  speak: (text: string) => void;
  speaking: boolean;
  supported: boolean;
}

export function useSpeechSynthesis(): SpeechSynthesisControls {
  const [supported, setSupported] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const keepAlive = React.useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

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
      window.speechSynthesis.removeEventListener("voiceschanged", syncSupport);
  }, []);

  const stopKeepAlive = React.useCallback(() => {
    clearInterval(keepAlive.current);
    keepAlive.current = undefined;
  }, []);

  const cancel = React.useCallback(() => {
    stopKeepAlive();
    setSpeaking(false);
    window.speechSynthesis.cancel();
  }, [stopKeepAlive]);

  const speak = React.useCallback(
    (text: string) => {
      // cancel() clears anything already queued, including an utterance started
      // by another card, so only one article is ever read at a time. The
      // displaced utterance fires onend, which resets that card's button.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const handleDone = () => {
        stopKeepAlive();
        setSpeaking(false);
      };
      utterance.onend = handleDone;
      utterance.onerror = handleDone;

      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
      keepAlive.current = setInterval(() => {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, KEEPALIVE_INTERVAL_MS);
    },
    [stopKeepAlive],
  );

  // Stop playback when the card goes away (navigation, filtering, dismissal).
  React.useEffect(
    () => () => {
      stopKeepAlive();
      window.speechSynthesis?.cancel();
    },
    [stopKeepAlive],
  );

  return { cancel, speak, speaking, supported };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test:components -- use-speech-synthesis
```

Expected: PASS — 7 passed.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-speech-synthesis.ts tests/components/hooks/use-speech-synthesis.test.tsx tests/helpers/speech-synthesis.ts
git commit -m "feat: add useSpeechSynthesis hook"
```

---

### Task 3: `ReadAloudButton` component

**Files:**

- Create: `src/components/article/read-aloud-button.tsx`
- Test: `tests/components/article/read-aloud-button.test.tsx`

**Interfaces:**

- Consumes: `useSpeechSynthesis` from `@/hooks/use-speech-synthesis` (Task 2),
  and `FakeUtterance` / `installSpeechEngine` from
  `tests/helpers/speech-synthesis.ts` (Task 2). Do not redefine the fake engine
  — import it.
- Produces: default export `ReadAloudButton` with props
  `{ text: string; title: string; variant?: "secondary" | "ghost" }`. Task 4
  renders it with exactly these props.

The component mirrors `src/components/article/toggle-starred-button.tsx`:
`TooltipProvider` → `Tooltip` → `TooltipTrigger asChild` → `Button` with
`size="icon"` and `className="cursor-pointer"`, icon at `size-4`. Returning
`null` when unusable follows `comments-button.tsx:26`.

An `aria-label` is required: an icon-only button has no text for the accessible
name to come from, and the tests query by role + name.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/article/read-aloud-button.test.tsx`:

```tsx
import ReadAloudButton from "@/components/article/read-aloud-button";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeUtterance,
  installSpeechEngine,
} from "../../helpers/speech-synthesis";

afterEach(() => vi.unstubAllGlobals());

describe("ReadAloudButton", () => {
  it("speaks the title followed by the lead", async () => {
    const speechSynthesis = installSpeechEngine();
    render(
      <ReadAloudButton
        title="Kernel 7.2 removes strncpy"
        text="It landed after 362 patches."
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /read aloud/i }),
    );

    expect(speechSynthesis.speak).toHaveBeenCalledOnce();
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    expect(utterance.text).toBe(
      "Kernel 7.2 removes strncpy. It landed after 362 patches.",
    );
  });

  it("stops playback when clicked a second time", async () => {
    const speechSynthesis = installSpeechEngine();
    render(<ReadAloudButton title="A title" text="A lead." />);

    await userEvent.click(
      await screen.findByRole("button", { name: /read aloud/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /stop reading/i }),
    );

    // speak() cancels once to clear the queue; stopping cancels again.
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /read aloud/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing when the browser has no speech engine", () => {
    const { container } = render(
      <ReadAloudButton title="A title" text="A lead." />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no voices are installed", async () => {
    installSpeechEngine([]);
    const { container } = render(
      <ReadAloudButton title="A title" text="A lead." />,
    );

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:components -- read-aloud-button
```

Expected: FAIL —
`Failed to resolve import "@/components/article/read-aloud-button"`.

- [ ] **Step 3: Write the component**

Create `src/components/article/read-aloud-button.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { SquareIcon, Volume2Icon } from "lucide-react";

interface ReadAloudButtonProps {
  text: string;
  title: string;
  variant?: "secondary" | "ghost";
}

const ReadAloudButton = ({
  text,
  title,
  variant = "secondary",
}: ReadAloudButtonProps) => {
  const { cancel, speak, speaking, supported } = useSpeechSynthesis();

  // Without a speech engine the button would silently do nothing when pressed,
  // so hide it rather than render a dead control.
  if (!supported) {
    return null;
  }

  const label = speaking ? "Stop reading" : "Read aloud";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            aria-label={label}
            onClick={() => (speaking ? cancel() : speak(`${title}. ${text}`))}
            className="cursor-pointer"
          >
            {speaking ? (
              <SquareIcon className="size-4 fill-current" />
            ) : (
              <Volume2Icon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ReadAloudButton;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:components -- read-aloud-button
```

Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/article/read-aloud-button.tsx tests/components/article/read-aloud-button.test.tsx
git commit -m "feat: add read-aloud button component"
```

---

### Task 4: Render the button in the card actions

**Files:**

- Modify: `src/components/article/article-card-actions.tsx`

**Interfaces:**

- Consumes: `ReadAloudButton` from Task 3.
- Produces: `ArticleCardActionsProps` gains `leadText?: string`. Task 5 passes
  it.

The component renders two independent layouts — a mobile block (`md:hidden`) and
a desktop block (`hidden md:flex`). The button goes in the icon cluster of each,
next to `CommentsButton`, so it does not compete with the primary Summarize /
Read actions.

- [ ] **Step 1: Add the import**

In `src/components/article/article-card-actions.tsx`, add to the import block at
the top (Prettier's organize-imports will sort it into place):

```tsx
import ReadAloudButton from "@/components/article/read-aloud-button";
```

- [ ] **Step 2: Add the prop to the interface**

Change the props interface to add `leadText`:

```tsx
interface ArticleCardActionsProps {
  article: Prisma.ArticleGetPayload<{
    include: { feed: true; scrape: true };
  }>;
  hideSummarizeButton?: boolean;
  leadText?: string;
  onAfterDismiss?: () => void;
  readingTime?: { text: string; minutes: number; time: number; words: number };
}
```

- [ ] **Step 3: Render it in the mobile icon row**

In the `{/* Mobile: row 1 — reading time left, icon buttons right */}` block,
add after `<CommentsButton article={props.article} variant="ghost" />`:

```tsx
{
  props.leadText && (
    <ReadAloudButton
      text={props.leadText}
      title={props.article.title}
      variant="ghost"
    />
  );
}
```

- [ ] **Step 4: Render it in the desktop row**

In the `{/* Desktop: single row */}` block, add after
`<CommentsButton article={props.article} />`:

```tsx
{
  props.leadText && (
    <ReadAloudButton text={props.leadText} title={props.article.title} />
  );
}
```

- [ ] **Step 5: Verify nothing broke**

```bash
npm run test:components
npx tsc --noEmit
```

Expected: all component tests PASS, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/article/article-card-actions.tsx
git commit -m "feat: render read-aloud button in article card actions"
```

---

### Task 5: Pass the lead text down from the card

**Files:**

- Modify: `src/components/article/article-card.tsx:144-147`

**Interfaces:**

- Consumes: the `leadText` prop added in Task 4.
- Produces: nothing further depends on this.

> **Reminder:** this file carries a pre-existing, unrelated change to
> `ArticleMeta` from the in-flight author feature. The commit below includes it
> and says so. If that is not acceptable, stop and ask the user.

- [ ] **Step 1: Pass `aiLead` into the actions component**

In `src/components/article/article-card.tsx`, find the `<ArticleCardActions>`
element inside `<CardFooter>` and add the `leadText` prop:

```tsx
<ArticleCardActions
  article={props.article}
  leadText={aiLead}
  readingTime={articleReadingTime}
/>
```

`aiLead` is the state declared at line 36. It is `undefined` until the lead has
been generated, which is why `leadText` is optional and the button is hidden
until then.

- [ ] **Step 2: Run the full test suite**

```bash
npm run test
npm run test:components
```

Expected: all PASS.

- [ ] **Step 3: Run lint, types and formatting**

```bash
npm run lint
npx tsc --noEmit
npm run format:check
```

Expected: no errors. If `format:check` reports the new files, run
`npm run format` and re-check.

- [ ] **Step 4: Verify by hand in the browser**

```bash
npm run dev
```

Open a feed, wait for a card's AI lead to render, and confirm:

- a speaker icon appears in the icon cluster (desktop: right of the comments
  icon; mobile: the same, in the top row)
- clicking it reads the headline then the lead
- the icon becomes a stop square while speaking, and clicking again stops it
- clicking a second card's button interrupts the first, and the first card's
  icon reverts to the speaker
- a lead longer than ~15 seconds plays to the end without cutting off (this is
  the Chrome keepalive working)

**Note on Linux:** if no audio plays and the button never appears, the machine
has no `speech-dispatcher` voices installed. That is the intended fallback, not
a bug — verify in Chrome on a machine with system voices.

- [ ] **Step 5: Commit**

```bash
git add src/components/article/article-card.tsx
git commit -m "feat: read article title and lead aloud from the card

Passes the AI lead into ArticleCardActions so the read-aloud button has
text to speak. Also includes a pre-existing uncommitted change to
ArticleMeta from the in-flight article-author work, which could not be
separated from this file."
```

---

## Notes for the implementer

**Screenshots and e2e are unaffected.** Headless Chromium ships no speech
synthesis voices, so `getVoices()` returns `[]`, the button renders `null`, and
the card looks identical under Playwright. This means the mobile-overflow
regression test in `tests/e2e/article-card.spec.ts` will not see the extra
button, and `npm run update-screenshots` does not need re-running. If you later
want the button captured in screenshots, it would need a stubbed speech engine
injected via `page.addInitScript`.

**Deliberately out of scope.** A keyboard shortcut would slot into the
`createHotkeyHandler` pattern at `article-card.tsx:44` alongside the existing
`s` / `v` / `m` bindings, but this plan covers the button only, as specified.
