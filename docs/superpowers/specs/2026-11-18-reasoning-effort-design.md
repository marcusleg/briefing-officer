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

`getFirstConfiguredLanguageModel()` in `src/lib/ai/registry.ts` wraps the model
it returns:

```ts
wrapLanguageModel({
  model,
  middleware: defaultSettingsMiddleware({
    settings: { reasoning: reasoningEffort },
  }),
});
```

Every caller — `streamGeneration`, the lead service and the filter-suggestion
service — already gets its model from this function, so none of them change, and
any future generation picks the setting up automatically. The wrapped model
keeps its `modelId`, so logging and token-usage billing are unaffected.

The model is always wrapped, including for `provider-default`. The SDK treats
`provider-default` as "send nothing", so the request is identical to today's,
and there is no second code path to test.

### Provider behavior

The SDK translates the level per provider:

- **Anthropic:** models with adaptive thinking receive an effort level; older
  models receive a thinking budget derived from the level. `none` disables
  thinking where the model allows it.
- **OpenAI and Azure OpenAI:** the level becomes `reasoning_effort`. For model
  IDs the SDK recognizes, a level the model does not support is dropped with a
  warning.

For a model ID the SDK does not recognize — typically an alias defined by an
OpenAI-compatible proxy — the level is passed through unchecked, and an
unsupported one (such as `minimal` on GPT-6 Luna) is rejected by the API. The
README says so.

### Documentation

`README.md` gets a row in the "AI Providers" table:

| Environment Variable  | Description                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_REASONING_EFFORT` | How much the model reasons before answering: `none`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`. Defaults to `provider-default`, which leaves it to the provider. Use a level your model supports; see the note below. |

followed by a short note on unrecognized model IDs as described above.

The Helm chart needs no change: its `env` list already passes arbitrary
variables to the container.

## Testing

- **Unit, `tests/unit/reasoningEffort.test.ts`:** `parseReasoningEffort` with
  unset, empty, each valid level, mixed case and surrounding whitespace, and an
  invalid value — asserting the `provider-default` fallback and the logged
  warning.
- **Unit, registry wrapping:** a model wrapped as the registry wraps it, backed
  by the SDK's `MockLanguageModelV4`, passes the configured `reasoning` to
  `doGenerate`/`doStream`; with `provider-default` it passes `provider-default`,
  which providers treat as unset.
- The existing generation tests keep passing unchanged, which shows the call
  sites are unaffected.

## Release

A single `feat: make the AI reasoning effort configurable` commit. Deployments
that do not set the variable see no change in behavior.
