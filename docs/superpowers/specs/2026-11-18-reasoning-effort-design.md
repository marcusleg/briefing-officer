# Configurable Reasoning Effort

## Intent

Briefing Officer never tells the model how much to reason, so every generation
runs at the provider's default. That default is not "no reasoning": current
Claude models think adaptively at high effort, and OpenAI's GPT-6 models default
to medium. A probe against GPT-6 Luna confirmed it — requests without an effort
used as many reasoning tokens as requests asking for `medium`, about half again
as many as `low`.

Operators should be able to pick the effort, typically to trade quality for cost
and latency on high-volume generations such as leads. The setting is
instance-wide and lives next to the existing model configuration.

## Goals

- One environment variable, `AI_REASONING_EFFORT`, that sets the reasoning
  effort for every AI generation.
- Unset, behavior is exactly what it is today: no reasoning parameter reaches
  the provider.
- Works across all three providers (Anthropic, Azure OpenAI, OpenAI-compatible)
  without provider-specific code.

## Non-goals

- A per-user setting or any UI. Cost is the operator's concern, and users must
  not be able to raise it.
- Different efforts per generation type (lead, summary, audio script, filter
  suggestions). One value for all until there is a reason to split it.
- Provider-specific variables (`ANTHROPIC_REASONING_EFFORT`, …). Only one
  provider is ever active.
- Validating a level against what the configured model supports. The AI SDK does
  this where it knows the model.

## Design

### Configuration

`AI_REASONING_EFFORT` accepts the AI SDK's reasoning levels:

`provider-default`, `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`

- The value is trimmed and lowercased before matching, as `LOG_LEVEL` is.
- Unset or empty means `provider-default`.
- An unrecognized value logs a warning naming the value and the accepted levels,
  then falls back to `provider-default`. A typo must not stop the server, but it
  must not pass silently either.

Parsing lives in a new `src/lib/ai/reasoningEffort.ts`, which exports a pure
`parseReasoningEffort(value: string | undefined)` and the resolved
`reasoningEffort` read from `process.env` at module load. The type of a level is
the SDK's own `LanguageModelV4CallOptions["reasoning"]`, not a copy of the
union.

### Wiring

`reasoningEffort.ts` also exports
`withReasoningEffort(model, reasoning): LanguageModelV4`, which wraps a model in
a middleware that fills in `reasoning` for any call that does not set its own:

```ts
wrapLanguageModel({
  model,
  middleware: {
    specificationVersion: "v4",
    transformParams: async ({ params }) => {
      const effective = params.reasoning ?? reasoning;

      if (effective === "provider-default") {
        return { ...params, reasoning: effective };
      }

      return {
        ...params,
        reasoning: effective,
        providerOptions: {
          ...params.providerOptions,
          openai: { forceReasoning: true, ...params.providerOptions?.openai },
        },
      };
    },
  },
});
```

For OpenAI and Azure OpenAI the SDK omits `reasoning` from the request for any
model ID it does not recognize as a reasoning model, such as an alias defined by
an OpenAI-compatible proxy or a custom Azure deployment name, so a configured
level would silently do nothing. Whenever the effective level is anything other
than `provider-default`, the middleware therefore also sets the `forceReasoning`
provider option. A call's own `openai` options win over it. The Azure provider
reads the `azure` options key and falls back to `openai`; Anthropic ignores the
`openai` key. Side effects of forcing: the system prompt is sent with the
`developer` role, OpenAI requests a reasoning summary by default once an effort
is set, and a model that cannot reason rejects the request instead of silently
ignoring the setting. With `provider-default` nothing is added.

The SDK's `defaultSettingsMiddleware` would do the same at runtime, but its
`settings` type has no `reasoning` field.

`getFirstConfiguredLanguageModel()` in `src/lib/ai/registry.ts` returns its
model wrapped with the configured `reasoningEffort`. Every caller —
`streamGeneration`, the lead service and the filter-suggestion service — already
gets its model from this function, so none of them change, and any future
generation picks the setting up automatically. The wrapped model keeps its
`modelId`, so logging and token-usage billing are unaffected.

The model is always wrapped, including for `provider-default`. The SDK treats
`provider-default` as "send nothing", so the request is identical to today's,
and there is no second code path to test.

### Provider behavior

The SDK translates the level per provider:

- **Anthropic:** models with adaptive thinking receive an effort level; older
  models receive a thinking budget derived from the level. `none` disables
  thinking where the model allows it. A level the model does not support is
  mapped to the nearest supported one, with a compatibility warning.
- **OpenAI and Azure OpenAI:** the level becomes `reasoning.effort` in the
  Responses API request. GPT-6 model IDs drop an unsupported level with a
  warning; other recognized reasoning models (`gpt-5…`, `o…`) get the level
  unchecked, so the API may reject an unsupported one. Unrecognized IDs, such as
  proxy aliases and custom Azure deployment names, are forced as described under
  Wiring and get the level unchecked too.

### Documentation

`README.md` gets a row in the "AI Providers" table:

| Environment Variable  | Description                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_REASONING_EFFORT` | How much the model reasons before answering: `none`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`. Defaults to `provider-default`, which leaves it to the provider. |

followed by a paragraph saying that, for OpenAI and Azure OpenAI, a level also
makes the SDK treat the model as a reasoning model, that an unsupported level is
replaced by the nearest supported one, dropped with a warning, or rejected by
the API depending on provider and model, and that a model that cannot reason
rejects any level other than `provider-default`.

The Helm chart needs no change: its `env` list already passes arbitrary
variables to the container.

## Testing

- **Unit, `tests/unit/reasoningEffort.test.ts`:** `parseReasoningEffort` with
  unset, empty, each valid level, mixed case and surrounding whitespace, and an
  invalid value — asserting the `provider-default` fallback and the logged
  warning.
- **Unit, same file:** `withReasoningEffort` around the SDK's
  `MockLanguageModelV4` keeps the `modelId`, passes the level to `doGenerate`
  (`generateText`, the same `doGenerate` path `generateObject` uses) and
  `doStream` (`streamText`), and yields to a call that sets its own `reasoning`.
- **Unit, same file, wire level:** the real `createOpenAI` and `createAzure`
  providers with a fake `fetch` that captures the request body. A level reaches
  the body for an unrecognized OpenAI model ID and a custom Azure deployment
  name; `provider-default` adds no `reasoning` key and keeps the `system` role;
  and a call's own `openai` provider options survive next to `forceReasoning`
  (checked on the mock model).
- The existing generation tests keep passing unchanged, which shows the call
  sites are unaffected.

## Release

A single `feat: make the AI reasoning effort configurable` commit. Deployments
that do not set the variable see no change in behavior.
