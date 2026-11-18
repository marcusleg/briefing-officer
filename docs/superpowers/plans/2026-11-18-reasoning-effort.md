# Configurable Reasoning Effort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators set the reasoning effort of every AI generation with an
`AI_REASONING_EFFORT` environment variable, defaulting to the provider's own
default.

**Architecture:** A new `src/lib/ai/reasoningEffort.ts` parses the variable and
exports `withReasoningEffort`, which wraps a language model in a middleware that
fills in the AI SDK's `reasoning` call option. The model registry wraps the
model it hands out, so every existing caller (`streamGeneration`, the lead
service, the filter-suggestion service) picks the setting up without changes.

**Tech Stack:** Next.js 16, TypeScript, Vercel AI SDK 7 (`ai`,
`@ai-sdk/provider`), Vitest, pino logger.

**Spec:** `docs/superpowers/specs/2026-11-18-reasoning-effort-design.md`

## Global Constraints

- Variable name: `AI_REASONING_EFFORT`.
- Accepted levels: `provider-default`, `none`, `minimal`, `low`, `medium`,
  `high`, `xhigh`, `max`. Matching trims and lowercases the value.
- Unset or empty → `provider-default`. Unknown → `logger.warn` naming the value,
  then `provider-default`. Never throw.
- No change to any call site (`streamGeneration.ts`, `leadService.ts`,
  `filterSuggestionService.ts`).
- The level type comes from the SDK (`LanguageModelV4CallOptions["reasoning"]`),
  never a hand-written union.
- American spelling in code, docs and commits. Conventional Commits without
  scopes.
- Public repo: no personal hostnames, proxy names or model aliases in code,
  docs, commits or PRs.

## Environment setup (once, before Task 1)

The worktree needs dependencies and the generated Prisma client, or tests fail
with `Cannot find package '@/generated/prisma/client'`:

```bash
cd /home/marcus/.herdr/worktrees/briefing-officer/reasoning-effort
[ -d node_modules ] || npm ci --no-audit --no-fund
npx prisma generate
```

Logger calls are globally mocked in `vitest.setup.ts` (`logger.warn` is a
`vi.fn()`, cleared after every test), so tests can assert on `logger.warn`
directly.

---

### Task 1: Configurable reasoning effort

One task, one `feat:` commit: the module is meaningless until the registry uses
it, and the README row documents the same change.

**Files:**

- Create: `src/lib/ai/reasoningEffort.ts`
- Create: `tests/unit/reasoningEffort.test.ts`
- Modify: `src/lib/ai/registry.ts` (the `return` at the end of
  `getFirstConfiguredLanguageModel`, plus one import)
- Modify: `README.md` (the "AI Providers" table)

**Interfaces:**

- Consumes: `LanguageModelV4`, `LanguageModelV4CallOptions` from
  `@ai-sdk/provider`; `wrapLanguageModel` from `ai`; default `logger` from
  `@/lib/logger`.
- Produces (in `src/lib/ai/reasoningEffort.ts`):
  - `type ReasoningEffort = NonNullable<LanguageModelV4CallOptions["reasoning"]>`
  - `parseReasoningEffort(value: string | undefined): ReasoningEffort`
  - `const reasoningEffort: ReasoningEffort`, from
    `process.env.AI_REASONING_EFFORT` at module load
  - `withReasoningEffort(model: LanguageModelV4, reasoning: ReasoningEffort): LanguageModelV4`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/reasoningEffort.test.ts`:

```ts
import {
  parseReasoningEffort,
  withReasoningEffort,
} from "@/lib/ai/reasoningEffort";
import logger from "@/lib/logger";
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { generateText, streamText } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

describe("parseReasoningEffort", () => {
  it("leaves the effort to the provider when unset or empty", () => {
    expect(parseReasoningEffort(undefined)).toBe("provider-default");
    expect(parseReasoningEffort("")).toBe("provider-default");
    expect(parseReasoningEffort("   ")).toBe("provider-default");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    "provider-default",
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ])("accepts %s", (level) => {
    expect(parseReasoningEffort(level)).toBe(level);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("ignores case and surrounding whitespace", () => {
    expect(parseReasoningEffort("  High \n")).toBe("high");
  });

  it("falls back to the provider default and warns on an unknown level", () => {
    expect(parseReasoningEffort("hgih")).toBe("provider-default");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ value: "hgih" }),
      expect.stringContaining("AI_REASONING_EFFORT"),
    );
  });
});

const generateResult: LanguageModelV4GenerateResult = {
  content: [{ type: "text", text: "Hello." }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: {
      total: 3,
      noCache: 3,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 2, text: 2, reasoning: undefined },
  },
  warnings: [],
};

const mockModel = () =>
  new MockLanguageModelV4({
    modelId: "test-model",
    doGenerate: generateResult,
    doStream: {
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "1" },
        { type: "text-delta", id: "1", delta: "Hello." },
        { type: "text-end", id: "1" },
        {
          type: "finish",
          finishReason: generateResult.finishReason,
          usage: generateResult.usage,
        },
      ]),
    },
  });

describe("withReasoningEffort", () => {
  it("keeps the model ID used for logging and billing", () => {
    expect(withReasoningEffort(mockModel(), "low").modelId).toBe("test-model");
  });

  it("sends the effort with generated responses", async () => {
    const model = mockModel();

    await generateText({
      model: withReasoningEffort(model, "low"),
      prompt: "Hi.",
    });

    expect(model.doGenerateCalls[0].reasoning).toBe("low");
  });

  it("sends the effort with streamed responses", async () => {
    const model = mockModel();

    const { text } = streamText({
      model: withReasoningEffort(model, "high"),
      prompt: "Hi.",
    });
    await text;

    expect(model.doStreamCalls[0].reasoning).toBe("high");
  });

  it("lets a call that sets its own effort override the default", async () => {
    const model = mockModel();

    await generateText({
      model: withReasoningEffort(model, "low"),
      prompt: "Hi.",
      reasoning: "none",
    });

    expect(model.doGenerateCalls[0].reasoning).toBe("none");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/reasoningEffort.test.ts`

Expected: FAIL. The suite cannot resolve `@/lib/ai/reasoningEffort`.

- [ ] **Step 3: Implement the module**

Create `src/lib/ai/reasoningEffort.ts`:

```ts
import logger from "@/lib/logger";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";

export type ReasoningEffort = NonNullable<
  LanguageModelV4CallOptions["reasoning"]
>;

// A record rather than an array so the type checker fails here if the SDK ever
// adds or removes a level: every key of the union must be present, and nothing
// else may be.
const reasoningEfforts: Record<ReasoningEffort, true> = {
  "provider-default": true,
  none: true,
  minimal: true,
  low: true,
  medium: true,
  high: true,
  xhigh: true,
  max: true,
};

const isReasoningEffort = (value: string): value is ReasoningEffort =>
  Object.hasOwn(reasoningEfforts, value);

/**
 * An unknown level falls back to the provider default instead of stopping the
 * server, as an unknown LOG_LEVEL does — but with a warning, so a typo does
 * not silently leave the effort where it was.
 */
export const parseReasoningEffort = (
  value: string | undefined,
): ReasoningEffort => {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "provider-default";
  }

  if (isReasoningEffort(normalized)) {
    return normalized;
  }

  logger.warn(
    { value, accepted: Object.keys(reasoningEfforts) },
    "Unknown AI_REASONING_EFFORT; leaving the reasoning effort to the provider.",
  );
  return "provider-default";
};

export const reasoningEffort = parseReasoningEffort(
  process.env.AI_REASONING_EFFORT,
);

/**
 * Sends `reasoning` with every call made through the model, unless the call
 * sets its own. Hand-written rather than the SDK's defaultSettingsMiddleware,
 * whose `settings` type has no `reasoning` field.
 *
 * "provider-default" is passed through like any other level: the providers
 * treat it as unset, so the request is the one they would get unwrapped.
 */
export const withReasoningEffort = (
  model: LanguageModelV4,
  reasoning: ReasoningEffort,
): LanguageModelV4 =>
  wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: "v4",
      transformParams: async ({ params }) => ({
        ...params,
        reasoning: params.reasoning ?? reasoning,
      }),
    },
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/reasoningEffort.test.ts`

Expected: PASS, 15 tests.

- [ ] **Step 5: Wrap the model in the registry**

In `src/lib/ai/registry.ts`, add the import next to the existing provider
imports:

```ts
import { reasoningEffort, withReasoningEffort } from "@/lib/ai/reasoningEffort";
```

and replace the last line of `getFirstConfiguredLanguageModel`:

```ts
return firstConfiguredFactory.create();
```

with:

```ts
return withReasoningEffort(
  await firstConfiguredFactory.create(),
  reasoningEffort,
);
```

Do not touch any caller of `getFirstConfiguredLanguageModel`.

- [ ] **Step 6: Document the variable**

In `README.md`, under `### AI Providers`, add this row as the first row of the
table (Prettier re-pads the columns in Step 7):

```markdown
| `AI_REASONING_EFFORT` | How much the model reasons before answering: `none`,
`minimal`, `low`, `medium`, `high`, `xhigh` or `max`. Defaults to
`provider-default`, which leaves it to the provider. |
```

and add this paragraph directly after the table, before `### Authentication`:

```markdown
Not every model supports every reasoning effort. For a model it recognizes, the
AI SDK drops an unsupported level and logs a warning. For a model name it does
not recognize, such as an alias defined by an OpenAI-compatible proxy, the level
is sent as is and the provider may reject the request.
```

- [ ] **Step 7: Run every CI check**

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all pass. `npm run test` includes the existing lead, summary and
filter-suggestion tests, which must pass unchanged — they mock
`@/lib/ai/registry`, so the new module is not loaded there. `npm run build` may
need the AI provider variables at module load; if it fails only for lack of
them, rerun as `OPENAI_API_KEY=build OPENAI_MODEL=build npm run build` and
report that you did.

If `next dev` or the build re-adds a block to `AGENTS.md`, leave that file out
of the commit.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/reasoningEffort.ts tests/unit/reasoningEffort.test.ts src/lib/ai/registry.ts README.md
git commit -F - <<'EOF'
feat: make the AI reasoning effort configurable

Operators can set AI_REASONING_EFFORT to none, minimal, low, medium,
high, xhigh or max to control how much the model reasons before
writing leads, summaries, audio scripts and filter suggestions. Unset,
the provider's own default applies, as before.

The model registry wraps the configured model in a middleware that
fills in the AI SDK's `reasoning` call option, so no generation call
site changes. An unknown value logs a warning and falls back to the
provider default.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

Do not use `--no-verify`. If the pre-commit hook changes files, re-stage them
and commit again.
