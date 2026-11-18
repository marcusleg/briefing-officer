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
 * Any level other than "provider-default" also sets the `forceReasoning`
 * provider option: OpenAI and Azure OpenAI drop the effort for model IDs the
 * SDK does not recognize as reasoning models, such as proxy aliases and custom
 * Azure deployment names. Azure falls back to the `openai` options key when it
 * has no `azure` one, and Anthropic ignores the key. A call's own `openai`
 * options win over it.
 *
 * "provider-default" leaves the request untouched: the providers treat it as
 * unset, so it is the one they would get unwrapped.
 */
export const withReasoningEffort = (
  model: LanguageModelV4,
  reasoning: ReasoningEffort,
): LanguageModelV4 =>
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
