# Server-Side Speech Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read audio summaries with an OpenAI-compatible TTS service, configured
with `OPENAI_TTS_*` variables, for articles in the languages that voice covers;
every other article keeps the browser's Web Speech API.

**Architecture:** A speech-provider registry (`src/lib/ai/speechRegistry.ts`,
mirroring the language-model registry) resolves a speech model for an article
language. An authenticated `POST /api/speech` route synthesizes one sentence
with the AI SDK's `generateSpeech`. On the client, a `ServerSpeechQueue` class
fetches sentence clips two ahead and plays them through one `<audio>` element;
`useServerSpeech` binds it to React with the same `SpeechControls` interface as
the existing `useSpeechSynthesis`, so `AudioSummaryPlayer` only picks which hook
drives it.

**Tech Stack:** Next.js 16 (App Router route handlers), TypeScript, Vercel AI
SDK 7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/provider`), React 19, Vitest (node and
jsdom projects), Testing Library, Prisma/SQLite.

**Spec:** `docs/superpowers/specs/2026-11-19-server-speech-design.md`

## Global Constraints

- Read `AGENTS.md` first. American English everywhere (code, comments, docs,
  commit messages).
- Colors only through design tokens; no raw Tailwind palette classes.
- Comments describe the code as it is and why; never history ("replaced",
  "previously", "fixed").
- Commit messages: Conventional Commits, no scopes. Use exactly the message each
  task gives. Never use `--no-verify`; the pre-commit hook runs eslint and
  Prettier.
- Env var names, exactly: `OPENAI_TTS_BASE_URL`, `OPENAI_TTS_API_KEY`,
  `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENAI_TTS_LANGUAGES`.
- Default base URL `https://api.openai.com/v1`; default languages `en`.
- `/api/speech` text cap: 1,000 characters. Output format `mp3`. `maxRetries: 1`.
- Prefetch: the playing sentence plus the next 2; at most 2 requests in flight.
- Never let `createOpenAI` fall back to `OPENAI_BASE_URL` / `OPENAI_API_KEY`:
  always pass `baseURL` and `apiKey` explicitly.
- Test commands: `npx vitest run <file>` for one file. Full checks:
  `npm run format:check && npm run lint && npm run typecheck && npm run test`.
- If a test file `vi.mock`s modules, follow the patterns quoted in each task;
  `@/lib/logger` is already mocked globally by `vitest.setup.ts` for the node
  project.

## File Map

| File | Responsibility |
| --- | --- |
| `src/lib/ai/types.ts` (modify) | Add `AiSpeechModelFactory` type. |
| `src/lib/ai/speech-providers/openAi.ts` (create) | OpenAI-compatible speech provider factory, `parseSpeechLanguages`. |
| `src/lib/ai/speechRegistry.ts` (create) | `getSpeechModelFor(language)`. |
| `src/app/api/speech/route.ts` (create) | Authenticated sentence-to-mp3 endpoint. |
| `src/hooks/speech-controls.ts` (create) | `SpeechControls` interface shared by both hooks. |
| `src/hooks/use-speech-synthesis.ts` (modify) | Return `SpeechControls` (adds `buffering: false`, `error: false`). |
| `src/lib/server-speech-queue.ts` (create) | Clip fetching, prefetch window, `<audio>` playback, snapshot store. |
| `src/hooks/use-server-speech.ts` (create) | React binding for `ServerSpeechQueue`. |
| `src/components/article/audio-summary-player.tsx` (modify) | Engine prop, one wrapper per hook, spinner, error alert. |
| `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx` (modify) | Choose the engine on the server. |
| `.env.example`, `README.md` (modify) | Document the variables. |
| `tests/unit/speechRegistry.test.ts` (create) | Provider/registry tests. |
| `tests/integration/speechRoute.test.ts` (create) | Route tests. |
| `tests/helpers/server-speech.ts` (create) | `FakeAudio` and fake speech `fetch`. |
| `tests/components/hooks/use-server-speech.test.tsx` (create) | Hook/queue tests. |
| `tests/components/article/audio-summary-player.test.tsx` (modify) | `engine` prop; server-engine tests. |

---

### Task 1: Speech provider and registry

**Files:**
- Modify: `src/lib/ai/types.ts`
- Create: `src/lib/ai/speech-providers/openAi.ts`
- Create: `src/lib/ai/speechRegistry.ts`
- Test: `tests/unit/speechRegistry.test.ts`

**Interfaces:**
- Produces:
  - `parseSpeechLanguages(value: string | undefined): string[]` from
    `@/lib/ai/speech-providers/openAi`
  - `getSpeechModelFor(language: string | null): ConfiguredSpeechModel | undefined`
    from `@/lib/ai/speechRegistry`
  - `interface ConfiguredSpeechModel { model: SpeechModelV4; voice: string }`
    from `@/lib/ai/speechRegistry`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/speechRegistry.test.ts`:

```ts
import { parseSpeechLanguages } from "@/lib/ai/speech-providers/openAi";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { generateSpeech } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TTS_VARIABLES = [
  "OPENAI_TTS_BASE_URL",
  "OPENAI_TTS_API_KEY",
  "OPENAI_TTS_MODEL",
  "OPENAI_TTS_VOICE",
  "OPENAI_TTS_LANGUAGES",
];

const configure = (env: Record<string, string>) => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
};

beforeEach(() => {
  // Start every test from "nothing configured", including the language-model
  // variables the SDK would otherwise fall back to.
  for (const name of [...TTS_VARIABLES, "OPENAI_BASE_URL", "OPENAI_API_KEY"]) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseSpeechLanguages", () => {
  it("defaults to English when unset or empty", () => {
    expect(parseSpeechLanguages(undefined)).toEqual(["en"]);
    expect(parseSpeechLanguages("")).toEqual(["en"]);
    expect(parseSpeechLanguages(" , ")).toEqual(["en"]);
  });

  it("trims, lowercases and drops empty entries", () => {
    expect(parseSpeechLanguages(" EN, de ,,")).toEqual(["en", "de"]);
  });
});

describe("getSpeechModelFor", () => {
  it.each([
    { OPENAI_TTS_MODEL: "kokoro-latest" },
    { OPENAI_TTS_VOICE: "af_heart" },
    {},
  ])("is undefined unless model and voice are both set (%o)", (env) => {
    configure(env);

    expect(getSpeechModelFor("en")).toBeUndefined();
  });

  it("returns the configured model and voice for a covered language", () => {
    configure({ OPENAI_TTS_MODEL: "kokoro-latest", OPENAI_TTS_VOICE: "af_heart" });

    const speech = getSpeechModelFor("en");

    expect(speech?.model.modelId).toBe("kokoro-latest");
    expect(speech?.voice).toBe("af_heart");
  });

  it("is undefined for a language the voice does not cover", () => {
    configure({ OPENAI_TTS_MODEL: "kokoro-latest", OPENAI_TTS_VOICE: "af_heart" });

    expect(getSpeechModelFor("de")).toBeUndefined();
  });

  it("treats an unknown article language as the default language", () => {
    configure({ OPENAI_TTS_MODEL: "kokoro-latest", OPENAI_TTS_VOICE: "af_heart" });

    expect(getSpeechModelFor(null)).toBeDefined();
  });

  it("covers exactly the configured languages", () => {
    configure({
      OPENAI_TTS_MODEL: "tts",
      OPENAI_TTS_VOICE: "voice",
      OPENAI_TTS_LANGUAGES: "de, FR",
    });

    expect(getSpeechModelFor("de")).toBeDefined();
    expect(getSpeechModelFor("fr")).toBeDefined();
    expect(getSpeechModelFor("en")).toBeUndefined();
  });

  describe("requests", () => {
    const captureFetch = () => {
      const fetch = vi.fn(
        async (_url: string, _init?: RequestInit) =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "audio/mpeg" },
          }),
      );
      vi.stubGlobal("fetch", fetch);
      return fetch;
    };

    const synthesize = async () => {
      const speech = getSpeechModelFor("en")!;
      await generateSpeech({
        model: speech.model,
        voice: speech.voice,
        text: "Hello.",
        maxRetries: 0,
      });
    };

    it("goes to the TTS base URL with the TTS key", async () => {
      configure({
        OPENAI_TTS_BASE_URL: "https://tts.example/v1",
        OPENAI_TTS_API_KEY: "tts-key",
        OPENAI_TTS_MODEL: "kokoro-latest",
        OPENAI_TTS_VOICE: "af_heart",
      });
      const fetch = captureFetch();

      await synthesize();

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe("https://tts.example/v1/audio/speech");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer tts-key",
      );
    });

    it("never falls back to the language model's base URL or key", async () => {
      configure({
        OPENAI_BASE_URL: "https://llm.example/v1",
        OPENAI_API_KEY: "llm-secret",
        OPENAI_TTS_MODEL: "tts-1",
        OPENAI_TTS_VOICE: "alloy",
      });
      const fetch = captureFetch();

      await synthesize();

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/audio/speech");
      expect(new Headers(init?.headers).get("authorization")).not.toContain(
        "llm-secret",
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/speechRegistry.test.ts`
Expected: FAIL, cannot resolve `@/lib/ai/speech-providers/openAi`.

- [ ] **Step 3: Implement**

Append to `src/lib/ai/types.ts` (keep the existing content; change the import
line to also import `SpeechModelV4`):

```ts
import { LanguageModelV4, SpeechModelV4 } from "@ai-sdk/provider";

// ...existing AiLanguageModel / AiLanguageModelFactory unchanged...

interface AiSpeechModel {
  isConfigured: boolean;
  /** ISO 639-1 codes of the article languages this voice may read. */
  languages: string[];
  voice: string;
  create: () => SpeechModelV4;
}

/**
 * Synchronous, unlike the language-model factory: it reads the environment on
 * every call so the page and the route always agree with the current config.
 */
export type AiSpeechModelFactory = () => AiSpeechModel;
```

Create `src/lib/ai/speech-providers/openAi.ts`:

```ts
import type { AiSpeechModelFactory } from "@/lib/ai/types";
import { DEFAULT_LANGUAGE } from "@/lib/language";
import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Parses `OPENAI_TTS_LANGUAGES`. Many TTS models speak only some languages,
 * so the voice reads an article only when its language is listed here.
 */
export const parseSpeechLanguages = (value: string | undefined): string[] => {
  const languages = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");

  return languages.length > 0 ? languages : [DEFAULT_LANGUAGE];
};

const openAiSpeechModel: AiSpeechModelFactory = () => {
  const model = process.env.OPENAI_TTS_MODEL;
  const voice = process.env.OPENAI_TTS_VOICE;

  return {
    // No API key required: local TTS services often run without one.
    isConfigured: !!model && !!voice,
    languages: parseSpeechLanguages(process.env.OPENAI_TTS_LANGUAGES),
    voice: voice ?? "",
    create: () =>
      // Both settings are passed explicitly. Left undefined, the SDK reads
      // OPENAI_BASE_URL and OPENAI_API_KEY, which would send the language
      // model's credentials to the TTS service.
      createOpenAI({
        baseURL: process.env.OPENAI_TTS_BASE_URL || DEFAULT_BASE_URL,
        apiKey: process.env.OPENAI_TTS_API_KEY ?? "",
      }).speech(model!),
  };
};

export default openAiSpeechModel;
```

Create `src/lib/ai/speechRegistry.ts`:

```ts
import openAiSpeechModel from "@/lib/ai/speech-providers/openAi";
import { DEFAULT_LANGUAGE } from "@/lib/language";
import type { SpeechModelV4 } from "@ai-sdk/provider";

const speechModels = [openAiSpeechModel];

export interface ConfiguredSpeechModel {
  model: SpeechModelV4;
  voice: string;
}

/**
 * The speech model that should read an article in `language`, or undefined
 * when none is configured for it and the browser's own voices read it instead.
 */
export const getSpeechModelFor = (
  language: string | null,
): ConfiguredSpeechModel | undefined => {
  const spoken = language ?? DEFAULT_LANGUAGE;
  const provider = speechModels
    .map((factory) => factory())
    .find(
      (candidate) =>
        candidate.isConfigured && candidate.languages.includes(spoken),
    );

  return provider && { model: provider.create(), voice: provider.voice };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/speechRegistry.test.ts`
Expected: PASS (all tests). If the "never falls back" test fails on the
Authorization header because the SDK omits the header for an empty key, change
that assertion only to `expect(new Headers(init?.headers).get("authorization") ?? "").not.toContain("llm-secret")`.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/ai/types.ts src/lib/ai/speech-providers/openAi.ts src/lib/ai/speechRegistry.ts tests/unit/speechRegistry.test.ts
git commit -m "feat: add an OpenAI-compatible speech provider registry"
```

---

### Task 2: `POST /api/speech`

**Files:**
- Create: `src/app/api/speech/route.ts`
- Test: `tests/integration/speechRoute.test.ts`

**Interfaces:**
- Consumes: `getSpeechModelFor(language: string | null): { model, voice } | undefined`
  from `@/lib/ai/speechRegistry` (Task 1).
- Produces: `POST /api/speech` with JSON body `{ articleId: number; text: string }`.
  Responses: 200 audio bytes (`Content-Type` from the SDK, `audio/mpeg`), 400,
  401, 404, 422, 502 (plain-text bodies).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/speechRoute.test.ts`:

```ts
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/ai/speechRegistry", () => ({
  getSpeechModelFor: vi.fn(),
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateSpeech: vi.fn(),
}));

import { POST } from "@/app/api/speech/route";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { generateSpeech } from "ai";

const speechModel = { model: { modelId: "kokoro-latest" }, voice: "af_heart" };

const speechRequest = (body: unknown) =>
  new Request("http://localhost/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let userId: string;
let articleId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  const feed = await createFeed({ userId });
  const article = await createArticle({ userId, feedId: feed.id });
  await prisma.article.update({
    where: { id: article.id },
    data: { language: "en" },
  });
  articleId = article.id;

  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId },
  } as never);
  vi.mocked(getSpeechModelFor).mockReturnValue(speechModel as never);
  vi.mocked(generateSpeech).mockResolvedValue({
    audio: {
      uint8Array: new Uint8Array([1, 2, 3]),
      mediaType: "audio/mpeg",
      base64: "AQID",
      format: "mp3",
    },
    warnings: [],
    responses: [],
    providerMetadata: {},
  } as never);
});

describe("POST /api/speech", () => {
  it("returns the synthesized audio", async () => {
    const response = await POST(speechRequest({ articleId, text: " Hello. " }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(generateSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        model: speechModel.model,
        voice: "af_heart",
        text: "Hello.",
        outputFormat: "mp3",
        maxRetries: 1,
      }),
    );
  });

  it("picks the voice from the article's language, not the client", async () => {
    await prisma.article.update({
      where: { id: articleId },
      data: { language: "de" },
    });

    await POST(speechRequest({ articleId, text: "Hallo.", language: "en" }));

    expect(getSpeechModelFor).toHaveBeenCalledWith("de");
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST(speechRequest({ articleId, text: "Hello." }));

    expect(response.status).toBe(401);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it.each([
    { name: "empty text", body: () => ({ articleId, text: "   " }) },
    {
      name: "text over 1,000 characters",
      body: () => ({ articleId, text: "a".repeat(1001) }),
    },
    { name: "non-string text", body: () => ({ articleId, text: 42 }) },
    { name: "non-integer article id", body: () => ({ articleId: "1", text: "Hi." }) },
    { name: "malformed JSON", body: () => undefined },
  ])("returns 400 for $name", async ({ body }) => {
    const value = body();
    const request =
      value === undefined
        ? new Request("http://localhost/api/speech", {
            method: "POST",
            body: "{not json",
          })
        : speechRequest(value);

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's article", async () => {
    const otherUser = await createUser();
    const otherFeed = await createFeed({ userId: otherUser.id });
    const otherArticle = await createArticle({
      userId: otherUser.id,
      feedId: otherFeed.id,
    });

    const response = await POST(
      speechRequest({ articleId: otherArticle.id, text: "Hello." }),
    );

    expect(response.status).toBe(404);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("returns 422 when no voice covers the article's language", async () => {
    vi.mocked(getSpeechModelFor).mockReturnValue(undefined);

    const response = await POST(speechRequest({ articleId, text: "Hello." }));

    expect(response.status).toBe(422);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("returns 502 and logs when the speech service fails", async () => {
    vi.mocked(generateSpeech).mockRejectedValue(new Error("upstream down"));

    const response = await POST(speechRequest({ articleId, text: "Hello." }));

    expect(response.status).toBe(502);
    expect(logger.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/speechRoute.test.ts`
Expected: FAIL, cannot resolve `@/app/api/speech/route`.

- [ ] **Step 3: Implement**

Create `src/app/api/speech/route.ts`:

```ts
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateSpeech } from "ai";
import { headers } from "next/headers";

// Briefing sentences are far shorter. The cap keeps the route from serving as
// a general-purpose TTS proxy for signed-in users.
const MAX_TEXT_LENGTH = 1000;

const textResponse = (text: string, status: number) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const parseBody = async (
  request: Request,
): Promise<{ articleId: number; text: string } | null> => {
  const body = (await request.json().catch(() => null)) as {
    articleId?: unknown;
    text?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (
    !Number.isInteger(body?.articleId) ||
    text === "" ||
    text.length > MAX_TEXT_LENGTH
  ) {
    return null;
  }

  return { articleId: body!.articleId as number, text };
};

/** Synthesizes one sentence of an article's audio briefing as mp3. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return textResponse("Sign in to listen.", 401);
  }

  const body = await parseBody(request);
  if (!body) {
    return textResponse("Invalid speech request.", 400);
  }

  const article = await prisma.article.findUnique({
    where: { id: body.articleId, userId: session.user.id },
    select: { language: true },
  });
  if (!article) {
    return textResponse("Article not found.", 404);
  }

  // The language comes from the stored article, never from the client, so a
  // voice only ever reads the languages it was configured for.
  const speech = getSpeechModelFor(article.language);
  if (!speech) {
    return textResponse(
      "No speech voice is configured for this article's language.",
      422,
    );
  }

  try {
    const { audio } = await generateSpeech({
      model: speech.model,
      voice: speech.voice,
      text: body.text,
      outputFormat: "mp3",
      maxRetries: 1,
      abortSignal: request.signal,
    });

    // Copied into a fresh Uint8Array so its buffer is a plain ArrayBuffer,
    // which is what BodyInit accepts.
    return new Response(new Uint8Array(audio.uint8Array), {
      headers: {
        "Content-Type": audio.mediaType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (!request.signal.aborted) {
      logger.error(
        { err: error, articleId: body.articleId },
        "Speech synthesis failed.",
      );
    }
    return textResponse("The speech service failed.", 502);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/speechRoute.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/app/api/speech/route.ts tests/integration/speechRoute.test.ts
git commit -m "feat: add a speech route that reads one sentence aloud"
```

---

### Task 3: `SpeechControls`, `ServerSpeechQueue` and `useServerSpeech`

**Files:**
- Create: `src/hooks/speech-controls.ts`
- Modify: `src/hooks/use-speech-synthesis.ts`
- Create: `src/lib/server-speech-queue.ts`
- Create: `src/hooks/use-server-speech.ts`
- Create: `tests/helpers/server-speech.ts`
- Test: `tests/components/hooks/use-server-speech.test.tsx`

**Interfaces:**
- Consumes: `POST /api/speech` with `{ articleId, text }` (Task 2), returning
  audio bytes on 2xx.
- Produces:
  - `interface SpeechControls` from `@/hooks/speech-controls` (fields below).
  - `useSpeechSynthesis(language: string | null): SpeechControls` (unchanged
    behavior; now also returns `buffering: false`, `error: false`).
  - `useServerSpeech(articleId: number): SpeechControls` from
    `@/hooks/use-server-speech`.
  - Test helper `installServerSpeech()` from `tests/helpers/server-speech.ts`
    (used again in Task 4), returning
    `{ fetch, requests, requested(), audio(), createObjectURL, revokeObjectURL }`
    where each `requests[i]` is
    `{ articleId, text, signal, respond(), fail(status?) }`, and `FakeAudio`
    with static `rejectNextPlay: string | undefined`.

- [ ] **Step 1: Extract the shared interface and adopt it in the browser hook**

Create `src/hooks/speech-controls.ts`:

```ts
/**
 * What the audio summary player needs from a speech engine. Implemented by
 * `useSpeechSynthesis` (the browser's voices) and `useServerSpeech` (a TTS
 * service behind /api/speech), so the player is indifferent to which one reads.
 */
export interface SpeechControls {
  /** Playback index of the sentence being heard, once audio has started. */
  activeIndex: number | undefined;
  /** Waiting for the current sentence's audio to arrive. */
  buffering: boolean;
  enqueue: (sentence: string) => void;
  /** Playback stopped because a sentence could not be synthesized. */
  error: boolean;
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

In `src/hooks/use-speech-synthesis.ts`:
- Delete the local `interface SpeechSynthesisControls { ... }` block.
- Add `import type { SpeechControls } from "@/hooks/speech-controls";`.
- Change the signature to `): SpeechControls {`.
- In the returned object add `buffering: false,` after `activeIndex,` and
  `error: false,` after `enqueue,`, with this comment above `buffering`:

```ts
    // The browser engine has no network round trip to wait on, and reports no
    // failures it could recover from.
```

Run: `npx vitest run tests/components/hooks/use-speech-synthesis.test.tsx tests/components/article/audio-summary-player.test.tsx`
Expected: PASS (no behavior change).

- [ ] **Step 2: Write the test helper**

Create `tests/helpers/server-speech.ts`:

```ts
import { vi } from "vitest";

/**
 * jsdom's HTMLMediaElement cannot play anything, so hooks driving an <audio>
 * element get this fake instead. Like a real element, assigning `src` resets
 * `playbackRate` to `defaultPlaybackRate`.
 */
export class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  /** Set to a DOMException name to make the next play() reject with it. */
  static rejectNextPlay: string | undefined;

  #src = "";
  defaultPlaybackRate = 1;
  playbackRate = 1;
  paused = true;

  constructor() {
    super();
    FakeAudio.instances.push(this);
  }

  get src() {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    this.paused = true;
    this.playbackRate = this.defaultPlaybackRate;
  }

  play = vi.fn(async () => {
    const rejection = FakeAudio.rejectNextPlay;
    if (rejection) {
      FakeAudio.rejectNextPlay = undefined;
      throw new DOMException("play() was rejected", rejection);
    }
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  /** Simulates the current clip playing to its end. */
  finish() {
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
  }
}

export interface FakeSpeechRequest {
  articleId: number;
  text: string;
  signal: AbortSignal;
  settled: boolean;
  /** Answers with a clip whose object URL is `blob:<text>`. */
  respond: () => void;
  fail: (status?: number) => void;
}

/**
 * Installs a fake `fetch` for /api/speech, the fake `Audio` constructor and
 * object-URL stubs. Each request stays pending until the test calls
 * `respond()` or `fail()` on it. Call `vi.unstubAllGlobals()` afterwards.
 */
export const installServerSpeech = () => {
  FakeAudio.instances = [];
  FakeAudio.rejectNextPlay = undefined;
  const requests: FakeSpeechRequest[] = [];

  const fetch = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise((resolve, reject) => {
        const body = JSON.parse(init.body as string) as {
          articleId: number;
          text: string;
        };
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () =>
          reject(new DOMException("The request was aborted", "AbortError")),
        );

        const request: FakeSpeechRequest = {
          ...body,
          signal,
          settled: false,
          respond: () => {
            request.settled = true;
            resolve({
              ok: true,
              status: 200,
              blob: async () => ({ text: body.text }),
            });
          },
          fail: (status = 502) => {
            request.settled = true;
            resolve({ ok: false, status, blob: async () => ({}) });
          },
        };
        requests.push(request);
      }),
  );

  const createObjectURL = vi.fn((blob: { text: string }) => `blob:${blob.text}`);
  const revokeObjectURL = vi.fn();

  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("Audio", FakeAudio);
  // jsdom has no object URLs; assigned rather than stubbed because the
  // property may not exist to spy on.
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;

  return {
    fetch,
    requests,
    requested: () => requests.map((request) => request.text),
    /** The most recently created audio element. */
    audio: () => FakeAudio.instances.at(-1)!,
    createObjectURL,
    revokeObjectURL,
  };
};
```

- [ ] **Step 3: Write the failing hook tests**

Create `tests/components/hooks/use-server-speech.test.tsx`:

```tsx
import { useServerSpeech } from "@/hooks/use-server-speech";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeAudio, installServerSpeech } from "../../helpers/server-speech";

afterEach(() => vi.unstubAllGlobals());

type Speech = ReturnType<typeof installServerSpeech>;

/** Lets the fetch → blob → object URL chain run to completion. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** Answers the latest live request for `text`. */
const respond = async (speech: Speech, text: string) => {
  speech.requests
    .filter((request) => request.text === text && !request.settled)
    .at(-1)!
    .respond();
  await settle();
};

const fail = async (speech: Speech, text: string) => {
  speech.requests
    .filter((request) => request.text === text && !request.settled)
    .at(-1)!
    .fail();
  await settle();
};

const finish = async (speech: Speech) => {
  act(() => speech.audio().finish());
  await settle();
};

const startPlayback = (sentences: string[]) => {
  const speech = installServerSpeech();
  const rendered = renderHook(() => useServerSpeech(42));

  act(() => {
    for (const sentence of sentences) {
      rendered.result.current.enqueue(sentence);
    }
    rendered.result.current.playFrom(0);
  });

  return { speech, ...rendered };
};

describe("useServerSpeech", () => {
  it("reports itself as supported with a voice", () => {
    installServerSpeech();
    const { result } = renderHook(() => useServerSpeech(42));

    expect(result.current.supported).toBe(true);
    expect(result.current.voiceAvailable).toBe(true);
  });

  it("does not request anything before playback starts", () => {
    const speech = installServerSpeech();
    const { result } = renderHook(() => useServerSpeech(42));

    act(() => result.current.enqueue("One."));

    expect(speech.fetch).not.toHaveBeenCalled();
  });

  it("posts each sentence with the article id to the speech route", () => {
    const { speech } = startPlayback(["One."]);

    expect(speech.fetch).toHaveBeenCalledWith(
      "/api/speech",
      expect.objectContaining({ method: "POST" }),
    );
    expect(speech.requests[0]).toMatchObject({ articleId: 42, text: "One." });
  });

  it("keeps two requests in flight and fills a window of two ahead", async () => {
    const { speech } = startPlayback(["One.", "Two.", "Three.", "Four."]);

    expect(speech.requested()).toEqual(["One.", "Two."]);

    await respond(speech, "One.");
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    await respond(speech, "Two.");
    // The window is the playing sentence plus two, so "Four." waits until
    // "One." has finished.
    expect(speech.requested()).toEqual(["One.", "Two.", "Three."]);

    await finish(speech);
    expect(speech.requested()).toEqual(["One.", "Two.", "Three.", "Four."]);
  });

  it("plays the clips in order and highlights the one playing", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);

    await respond(speech, "One.");
    expect(speech.audio().src).toBe("blob:One.");
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.speaking).toBe(true);

    await respond(speech, "Two.");
    await finish(speech);
    expect(speech.audio().src).toBe("blob:Two.");
    expect(result.current.activeIndex).toBe(1);
  });

  it("buffers while the next clip is still loading", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);
    expect(result.current.buffering).toBe(true);

    await respond(speech, "One.");
    expect(result.current.buffering).toBe(false);

    await finish(speech);
    expect(result.current.buffering).toBe(true);

    await respond(speech, "Two.");
    expect(result.current.buffering).toBe(false);
    expect(speech.audio().src).toBe("blob:Two.");
  });

  it("resumes for a sentence that arrives after playback ran dry", async () => {
    const { speech, result } = startPlayback(["One."]);
    await respond(speech, "One.");
    await finish(speech);

    expect(result.current.speaking).toBe(false);
    expect(result.current.buffering).toBe(false);
    expect(result.current.activeIndex).toBeUndefined();

    act(() => result.current.enqueue("Two."));
    expect(result.current.speaking).toBe(true);
    await respond(speech, "Two.");

    expect(speech.audio().src).toBe("blob:Two.");
    expect(result.current.activeIndex).toBe(1);
  });

  it("replays from the start without requesting the clips again", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);
    await respond(speech, "One.");
    await respond(speech, "Two.");
    await finish(speech);

    act(() => result.current.playFrom(0));
    await settle();

    expect(speech.audio().src).toBe("blob:One.");
    expect(speech.fetch).toHaveBeenCalledTimes(2);
  });

  it("drops requests outside the window when jumping ahead", async () => {
    const { speech, result } = startPlayback([
      "One.",
      "Two.",
      "Three.",
      "Four.",
      "Five.",
      "Six.",
    ]);

    act(() => result.current.playFrom(4));

    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(speech.requests[1].signal.aborted).toBe(true);
    expect(speech.requested().slice(2)).toEqual(["Five.", "Six."]);
  });

  it("changes speed without restarting or requesting again", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);
    await respond(speech, "One.");

    act(() => result.current.setRate(1.5));

    expect(result.current.rate).toBe(1.5);
    expect(speech.audio().playbackRate).toBe(1.5);
    expect(speech.audio().play).toHaveBeenCalledTimes(1);

    await respond(speech, "Two.");
    await finish(speech);

    // Assigning the next clip's src resets playbackRate to the default rate.
    expect(speech.audio().playbackRate).toBe(1.5);
    expect(speech.fetch).toHaveBeenCalledTimes(2);
  });

  it("applies a rate set before playback to the first clip", async () => {
    const speech = installServerSpeech();
    const { result } = renderHook(() => useServerSpeech(42));

    act(() => {
      result.current.setRate(1.2);
      result.current.enqueue("One.");
      result.current.playFrom(0);
    });
    await respond(speech, "One.");

    expect(speech.audio().playbackRate).toBe(1.2);
  });

  it("pauses and resumes the clip", async () => {
    const { speech, result } = startPlayback(["One."]);
    await respond(speech, "One.");

    act(() => result.current.pause());
    expect(speech.audio().pause).toHaveBeenCalled();
    expect(result.current.paused).toBe(true);

    act(() => result.current.resume());
    expect(speech.audio().play).toHaveBeenCalledTimes(2);
    expect(result.current.paused).toBe(false);
  });

  it("does not start a clip that arrives while paused", async () => {
    const { speech, result } = startPlayback(["One."]);

    act(() => result.current.pause());
    await respond(speech, "One.");

    expect(speech.audio().src).toBe("blob:One.");
    expect(speech.audio().play).not.toHaveBeenCalled();

    act(() => result.current.resume());
    expect(speech.audio().play).toHaveBeenCalledOnce();
  });

  it("waits for the reader when the browser blocks autoplay", async () => {
    const { speech, result } = startPlayback(["One."]);
    FakeAudio.rejectNextPlay = "NotAllowedError";

    await respond(speech, "One.");

    expect(result.current.paused).toBe(true);
    expect(result.current.error).toBe(false);

    act(() => result.current.resume());
    await settle();

    expect(result.current.paused).toBe(false);
    expect(result.current.activeIndex).toBe(0);
  });

  it("stops at a sentence that could not be synthesized and retries it on resume", async () => {
    const { speech, result } = startPlayback(["One.", "Two."]);

    await fail(speech, "One.");

    expect(result.current.error).toBe(true);
    expect(result.current.paused).toBe(true);
    expect(result.current.buffering).toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);

    act(() => result.current.resume());
    expect(result.current.error).toBe(false);
    expect(speech.requested().filter((text) => text === "One.")).toHaveLength(2);

    await respond(speech, "One.");
    expect(speech.audio().src).toBe("blob:One.");
    expect(result.current.activeIndex).toBe(0);
  });

  it("aborts requests, stops audio and revokes clips on unmount", async () => {
    const { speech, unmount } = startPlayback(["One.", "Two.", "Three."]);
    await respond(speech, "One.");

    unmount();

    expect(speech.requests[1].signal.aborted).toBe(true);
    expect(speech.audio().pause).toHaveBeenCalled();
    expect(speech.revokeObjectURL).toHaveBeenCalledWith("blob:One.");
  });

  it("revokes a clip that arrives after its request was dropped", async () => {
    const { speech, result } = startPlayback(["One.", "Two.", "Three.", "Four."]);
    const stale = speech.requests[0];

    act(() => result.current.playFrom(3));
    // The fake rejects aborted requests, so answer one that raced the abort.
    stale.respond();
    await settle();

    expect(speech.createObjectURL).not.toHaveBeenCalledWith({ text: "One." });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/components/hooks/use-server-speech.test.tsx`
Expected: FAIL, cannot resolve `@/hooks/use-server-speech`.

- [ ] **Step 5: Implement the queue**

Create `src/lib/server-speech-queue.ts`:

```ts
/**
 * Plays an audio briefing sentence by sentence through a TTS service behind
 * /api/speech.
 *
 * Sentences arrive one at a time while the script is still being generated.
 * Each is synthesized separately and the clips play back to back through one
 * <audio> element, so the briefing starts after one round trip rather than
 * after the whole script. The sentence playing and the next two are requested,
 * at most two at a time, which keeps a clip ready ahead of the voice without
 * flooding the service.
 *
 * Framework-free on purpose: fetching, playback and ending call each other,
 * which a class expresses directly. `useServerSpeech` binds it to React.
 */

const PREFETCH_AHEAD = 2;
const MAX_IN_FLIGHT = 2;

type Clip =
  | { status: "loading"; controller: AbortController }
  | { status: "ready"; url: string }
  | { status: "failed" };

// "ranDry" means playback stopped because it reached the last retained
// sentence, so the next enqueue() resumes it.
type Playback = "idle" | "playing" | "ranDry";

export interface ServerSpeechSnapshot {
  activeIndex: number | undefined;
  buffering: boolean;
  error: boolean;
  paused: boolean;
  rate: number;
  speaking: boolean;
}

export const INITIAL_SERVER_SPEECH_SNAPSHOT: ServerSpeechSnapshot = {
  activeIndex: undefined,
  buffering: false,
  error: false,
  paused: false,
  rate: 1,
  speaking: false,
};

export class ServerSpeechQueue {
  private readonly articleId: number;
  private sentences: string[] = [];
  private clips = new Map<number, Clip>();
  // The sentence playing, or the one playback is waiting for.
  private position = 0;
  private playback: Playback = "idle";
  // True while the clip at `position` is still loading.
  private waiting = false;
  private element: HTMLAudioElement | undefined;
  private snapshot = INITIAL_SERVER_SPEECH_SNAPSHOT;
  private listeners = new Set<() => void>();

  constructor(articleId: number) {
    this.articleId = articleId;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  enqueue = (sentence: string) => {
    this.sentences.push(sentence);

    if (this.playback === "ranDry") {
      this.playback = "playing";
      this.update({ speaking: true });
      this.playCurrent();
      return;
    }

    if (this.playback === "playing") {
      this.prefetch();
    }
  };

  playFrom = (index: number) => {
    this.element?.pause();

    // A failed clip is retried, and requests the new window does not need are
    // dropped so they do not hold up the ones it does.
    for (const [clipIndex, clip] of this.clips) {
      if (clip.status === "failed") {
        this.clips.delete(clipIndex);
      } else if (
        clip.status === "loading" &&
        (clipIndex < index || clipIndex > index + PREFETCH_AHEAD)
      ) {
        clip.controller.abort();
        this.clips.delete(clipIndex);
      }
    }

    this.position = index;
    this.playback = "playing";
    this.update({
      activeIndex: undefined,
      error: false,
      paused: false,
      speaking: true,
    });
    this.playCurrent();
  };

  pause = () => {
    this.element?.pause();
    this.update({ paused: true });
  };

  resume = () => {
    if (this.snapshot.error) {
      this.clips.delete(this.position);
      this.update({ error: false, paused: false });
      this.playCurrent();
      return;
    }

    this.update({ paused: false });

    // While waiting, the clip starts itself when it arrives.
    if (this.playback === "playing" && !this.waiting) {
      this.startElement();
    }
  };

  setRate = (rate: number) => {
    if (this.element) {
      // Loading a new src resets playbackRate to defaultPlaybackRate, so both
      // are set to carry the rate across clips.
      this.element.defaultPlaybackRate = rate;
      this.element.playbackRate = rate;
    }
    this.update({ rate });
  };

  /** Stops playback and releases every request and clip. Sentences are kept. */
  dispose = () => {
    this.playback = "idle";
    this.waiting = false;
    this.element?.pause();

    for (const clip of this.clips.values()) {
      if (clip.status === "loading") clip.controller.abort();
      if (clip.status === "ready") URL.revokeObjectURL(clip.url);
    }
    this.clips.clear();

    this.update({ activeIndex: undefined, buffering: false, speaking: false });
  };

  private update(patch: Partial<ServerSpeechSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private audio() {
    if (!this.element) {
      const element = new Audio();
      element.defaultPlaybackRate = this.snapshot.rate;
      element.playbackRate = this.snapshot.rate;
      element.addEventListener("playing", this.handlePlaying);
      element.addEventListener("ended", this.handleEnded);
      element.addEventListener("error", this.handleElementError);
      this.element = element;
    }
    return this.element;
  }

  private handlePlaying = () => {
    if (this.playback === "playing") {
      this.update({ activeIndex: this.position });
    }
  };

  private handleEnded = () => {
    if (this.playback !== "playing") return;
    this.position += 1;
    this.playCurrent();
  };

  // A clip the browser cannot decode stops playback like a failed request.
  private handleElementError = () => {
    if (this.playback === "playing") this.fail();
  };

  private playCurrent() {
    if (this.playback !== "playing") return;

    if (this.position >= this.sentences.length) {
      this.waiting = false;
      this.playback = "ranDry";
      this.update({ activeIndex: undefined, buffering: false, speaking: false });
      return;
    }

    this.prefetch();

    const clip = this.clips.get(this.position);
    if (clip?.status === "failed") {
      this.fail();
      return;
    }
    if (clip?.status !== "ready") {
      this.waiting = true;
      this.update({ buffering: true });
      return;
    }

    this.waiting = false;
    this.update({ buffering: false });

    const element = this.audio();
    element.src = clip.url;
    element.playbackRate = this.snapshot.rate;

    if (!this.snapshot.paused) {
      this.startElement();
    }
  }

  private startElement() {
    this.audio()
      .play()
      .catch((error: unknown) => {
        // Autoplay is blocked until the reader interacts with the page, as on
        // a reload. Waiting for the Play button is the expected outcome, not
        // an error. Any other rejection is play() being interrupted by a newer
        // src or a pause, which needs nothing.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          this.update({ paused: true });
        }
      });
  }

  private fail() {
    this.waiting = false;
    this.update({ buffering: false, error: true, paused: true });
  }

  private prefetch() {
    const last = Math.min(
      this.position + PREFETCH_AHEAD,
      this.sentences.length - 1,
    );

    for (let index = this.position; index <= last; index++) {
      if (this.inFlight() >= MAX_IN_FLIGHT) return;
      if (!this.clips.has(index)) this.request(index);
    }
  }

  private inFlight() {
    let count = 0;
    for (const clip of this.clips.values()) {
      if (clip.status === "loading") count += 1;
    }
    return count;
  }

  private request(index: number) {
    const controller = new AbortController();
    const entry: Clip = { status: "loading", controller };
    this.clips.set(index, entry);

    // A dropped or disposed request no longer owns its slot. Checking identity
    // rather than the abort signal also catches a response that raced the
    // abort, before an object URL is created for it.
    const current = () => this.clips.get(index) === entry;

    fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: this.articleId,
        text: this.sentences[index],
      }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Speech request failed with ${response.status}`);
        }
        return response.blob();
      })
      .then(
        (blob) => {
          if (!current()) return;
          this.settle(index, { status: "ready", url: URL.createObjectURL(blob) });
        },
        () => {
          if (!current()) return;
          this.settle(index, { status: "failed" });
        },
      );
  }

  private settle(index: number, clip: Clip) {
    this.clips.set(index, clip);

    if (this.waiting && index === this.position) {
      this.playCurrent();
    } else if (this.playback === "playing") {
      this.prefetch();
    }
  }
}
```

- [ ] **Step 6: Implement the hook**

Create `src/hooks/use-server-speech.ts`:

```ts
import type { SpeechControls } from "@/hooks/speech-controls";
import {
  INITIAL_SERVER_SPEECH_SNAPSHOT,
  ServerSpeechQueue,
} from "@/lib/server-speech-queue";
import * as React from "react";

const getServerSnapshot = () => INITIAL_SERVER_SPEECH_SNAPSHOT;

/**
 * Reads an article's briefing through the TTS service behind /api/speech.
 *
 * The queue is bound to the article it was created for. Each instance owns its
 * own <audio> element, so the overlap a client-side navigation creates needs no
 * coordination between pages.
 */
export function useServerSpeech(articleId: number): SpeechControls {
  const [queue] = React.useState(() => new ServerSpeechQueue(articleId));
  const state = React.useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    getServerSnapshot,
  );

  // Strict Mode runs this cleanup between its two mount passes. The queue
  // keeps its sentences through dispose(), so the player's replay works.
  React.useEffect(() => () => queue.dispose(), [queue]);

  return {
    ...state,
    enqueue: queue.enqueue,
    pause: queue.pause,
    playFrom: queue.playFrom,
    resume: queue.resume,
    setRate: queue.setRate,
    supported: true,
    voiceAvailable: true,
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/components/hooks/`
Expected: PASS (both hook test files). If a timing-sensitive test fails because
the promise chain has not settled, add one more `await settle()` in that test;
do not change the queue's behavior to suit the test.

- [ ] **Step 8: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

```bash
git add src/hooks/speech-controls.ts src/hooks/use-speech-synthesis.ts src/lib/server-speech-queue.ts src/hooks/use-server-speech.ts tests/helpers/server-speech.ts tests/components/hooks/use-server-speech.test.tsx
git commit -m "feat: play audio briefings from a speech service sentence by sentence"
```

---

### Task 4: Player, page and documentation

**Files:**
- Modify: `src/components/article/audio-summary-player.tsx`
- Modify: `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`
- Modify: `tests/components/article/audio-summary-player.test.tsx`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `useSpeechSynthesis(language)`, `useServerSpeech(articleId)`,
  `SpeechControls` (Task 3); `getSpeechModelFor(language)` (Task 1);
  `installServerSpeech()` and `FakeAudio` from `tests/helpers/server-speech.ts`
  (Task 3).
- Produces: `AudioSummaryPlayer` props
  `{ articleId: number; engine: "browser" | "server"; language: string | null; title: string }`.

- [ ] **Step 1: Update existing tests and add the server-engine tests**

In `tests/components/article/audio-summary-player.test.tsx`:

1. Change the shared `props` to include the engine:

```ts
const props = {
  articleId: 42,
  engine: "browser" as const,
  language: "en",
  title: "Kernel 7.2 removes strncpy",
};
```

2. Add to the imports:

```ts
import { FakeAudio, installServerSpeech } from "../../helpers/server-speech";
```

and add `act` to the `@testing-library/react` import.

3. Append this `describe` block at the end of the file:

```tsx
describe("AudioSummaryPlayer with server speech", () => {
  const serverProps = { ...props, engine: "server" as const };

  /** Answers the latest live request for `text` and lets playback react. */
  const respond = async (
    speech: ReturnType<typeof installServerSpeech>,
    text: string,
  ) => {
    await act(async () => {
      speech.requests
        .filter((request) => request.text === text && !request.settled)
        .at(-1)!
        .respond();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("requests the spoken title at mount and never touches browser speech", () => {
    const speech = installServerSpeech();
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...serverProps} />);

    expect(speech.requested()).toEqual([SPOKEN_TITLE]);
    expect(engine.speak).not.toHaveBeenCalled();
  });

  it("shows a spinner while the first clip loads", () => {
    installServerSpeech();

    render(<AudioSummaryPlayer {...serverProps} />);

    expect(
      within(screen.getByRole("button", { name: /pause/i })).getByRole(
        "status",
      ),
    ).toBeInTheDocument();
  });

  it("does not warn about browser voices", async () => {
    // No installSpeechEngine(): the browser has no voices at all.
    installServerSpeech();

    render(<AudioSummaryPlayer {...serverProps} language="en" />);

    await screen.findByText(/It landed after 362 patches\./);
    expect(screen.queryByText(/no speech voices/i)).not.toBeInTheDocument();
  });

  it("highlights the sentence whose clip is playing", async () => {
    const speech = installServerSpeech();

    render(<AudioSummaryPlayer {...serverProps} />);
    await screen.findByText(/Maintainers had warned for years\./);

    await respond(speech, SPOKEN_TITLE);
    await respond(speech, "Published at Hacker News, written by Jane Doe.");
    act(() => speech.audio().finish());

    await waitFor(() =>
      expect(
        screen.getByText(/Published at Hacker News, written by Jane Doe\./),
      ).toHaveAttribute("data-active", "true"),
    );
  });

  it("explains itself when the speech service fails", async () => {
    const speech = installServerSpeech();

    render(<AudioSummaryPlayer {...serverProps} />);
    await act(async () => {
      speech.requests[0].fail();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText(/speech unavailable/i)).toBeInTheDocument();
    // Play retries from the failed sentence.
    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(speech.requested().filter((text) => text === SPOKEN_TITLE)).toHaveLength(2);
  });

  it("plays the title under Strict Mode", async () => {
    const speech = installServerSpeech();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...serverProps} />
      </React.StrictMode>,
    );
    await respond(speech, SPOKEN_TITLE);

    expect(FakeAudio.instances.at(-1)?.src).toBe(`blob:${SPOKEN_TITLE}`);
  });
});
```

Add `within` to the `@testing-library/react` import as well.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/components/article/audio-summary-player.test.tsx`
Expected: the browser tests PASS (the extra `engine` prop is ignored for now);
the server-speech tests FAIL (no request made, no spinner).

- [ ] **Step 3: Implement the player**

Edit `src/components/article/audio-summary-player.tsx`:

1. Imports: add

```ts
import { Spinner } from "@/components/ui/spinner";
import type { SpeechControls } from "@/hooks/speech-controls";
import { useServerSpeech } from "@/hooks/use-server-speech";
```

2. Replace the props interface and the start of the component. The existing
component becomes `SpeechPlayer`, which takes its controls as a prop instead of
calling a hook:

```tsx
interface AudioSummaryPlayerProps {
  articleId: number;
  engine: "browser" | "server";
  language: string | null;
  title: string;
}

type SpeechPlayerProps = Omit<AudioSummaryPlayerProps, "engine"> & {
  speech: SpeechControls;
};

const SpeechPlayer = (props: SpeechPlayerProps) => {
  const {
    activeIndex,
    buffering,
    enqueue,
    error,
    pause,
    paused,
    playFrom,
    rate,
    resume,
    setRate,
    speaking,
    supported,
    voiceAvailable,
  } = props.speech;
```

Everything from the `// The hook keeps its own copy of the sentences…`
comment down to the end of the JSX stays as it is, except for the two edits in
steps 3 and 4 below.

3. Add the speech-error alert directly after the `generationFailed` alert:

```tsx
      {error && (
        <Alert>
          <AlertTitle>Speech unavailable</AlertTitle>
          <AlertDescription>
            The speech service could not read this briefing aloud. Press play to
            try again. The transcript below is unaffected.
          </AlertDescription>
        </Alert>
      )}
```

4. Replace the Play button's icon expression:

```tsx
          {buffering && !paused ? (
            <Spinner />
          ) : playing ? (
            <PauseIcon className="size-4 fill-current" />
          ) : (
            <PlayIcon className="size-4 fill-current" />
          )}
```

5. Replace `export default AudioSummaryPlayer;` and add the wrappers above it:

```tsx
// Each wrapper calls exactly one speech hook. Mounting only the selected one
// matters: the browser hook claims the global speechSynthesis on mount, and an
// idle instance on a server-speech page would take that ownership from the
// page being navigated away from, leaving its speech playing.
const BrowserSpeechPlayer = (props: Omit<AudioSummaryPlayerProps, "engine">) => {
  const speech = useSpeechSynthesis(props.language);
  return <SpeechPlayer {...props} speech={speech} />;
};

const ServerSpeechPlayer = (props: Omit<AudioSummaryPlayerProps, "engine">) => {
  const speech = useServerSpeech(props.articleId);
  return <SpeechPlayer {...props} speech={speech} />;
};

const AudioSummaryPlayer = ({ engine, ...props }: AudioSummaryPlayerProps) =>
  engine === "server" ? (
    <ServerSpeechPlayer {...props} />
  ) : (
    <BrowserSpeechPlayer {...props} />
  );

export default AudioSummaryPlayer;
```

The "Playback unavailable" and "Voice unavailable" alerts need no change: the
server hook always reports `supported` and `voiceAvailable`.

- [ ] **Step 4: Choose the engine on the page**

In `src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx`, add
`import { getSpeechModelFor } from "@/lib/ai/speechRegistry";` and pass the
engine:

```tsx
          <AudioSummaryPlayer
            articleId={article.id}
            // A configured voice for the article's language reads it;
            // otherwise the browser's own voices do.
            engine={getSpeechModelFor(article.language) ? "server" : "browser"}
            language={article.language}
            title={article.title}
          />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/components/article/ tests/components/hooks/`
Expected: PASS.

- [ ] **Step 6: Document the variables**

In `.env.example`, insert after the `OPENAI_MODEL=gpt-4o` line (keep one blank
line before `BASE_URL`):

```
# Optional OpenAI-compatible text-to-speech for audio summaries. Without it,
# the browser's own voices read them. OPENAI_TTS_BASE_URL defaults to
# https://api.openai.com/v1 and OPENAI_TTS_LANGUAGES to en.
#OPENAI_TTS_BASE_URL=
#OPENAI_TTS_API_KEY=
#OPENAI_TTS_MODEL=gpt-4o-mini-tts
#OPENAI_TTS_VOICE=alloy
#OPENAI_TTS_LANGUAGES=en
```

In `README.md`, insert a new section directly before `### Authentication`:

```markdown
### Text-to-Speech

Optional. Audio summaries are read by an OpenAI-compatible speech API when one
is configured for the article's language, and by the browser's own voices
otherwise.

| Environment Variable   | Description                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_TTS_BASE_URL`  | Optional base URL for an OpenAI-compatible speech API. Defaults to `https://api.openai.com/v1`.                     |
| `OPENAI_TTS_API_KEY`   | API key for the speech API.                                                                                         |
| `OPENAI_TTS_MODEL`     | Speech model name, e.g. `gpt-4o-mini-tts`.                                                                          |
| `OPENAI_TTS_VOICE`     | Voice name, e.g. `alloy`.                                                                                           |
| `OPENAI_TTS_LANGUAGES` | Comma-separated ISO 639-1 codes of the article languages the voice reads, e.g. `en,de`. Defaults to `en`.            |
```

Align the table columns so they match (Prettier no longer formats Markdown, so
pad by hand).

- [ ] **Step 7: Full checks and commit**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test`
Expected: all pass. Fix formatting with `npm run format` if needed.

```bash
git add src/components/article/audio-summary-player.tsx "src/app/feed/[feedId]/article/[articleId]/audio-summary/page.tsx" tests/components/article/audio-summary-player.test.tsx .env.example README.md
git commit -m "feat: read audio summaries with a configured speech service"
```

---

## After all tasks

The controller (not a task subagent):

1. Runs `npm run build` in addition to the checks above.
2. Smoke-tests against the local gateway (`OPENAI_TTS_MODEL=kokoro-latest`,
   `OPENAI_TTS_VOICE=af_heart`): an English article plays through
   `/api/speech`; a German article uses browser speech.
3. Squashes the three implementation `feat:` commits into one user-facing
   commit, `feat: read audio summaries with a configured speech service`, so
   the changelog gets one line. The docs commits stay separate.
4. Opens the PR against `main`.
