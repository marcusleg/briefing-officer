import { TokenUsage } from "@prisma/client";

export const TOKEN_PRICING: Record<
  string,
  { inputToken: number; outputToken: number }
> = {
  "claude-sonnet-4-20250514": {
    inputToken: 3 / 1_000_000,
    outputToken: 15 / 1_000_000,
  },
  "gpt-4.1-nano": {
    inputToken: 0.1 / 1_000_000,
    outputToken: 0.4 / 1_000_000,
  },
  "gpt-4.1-mini": {
    inputToken: 0.15 / 1_000_000,
    outputToken: 0.6 / 1_000_000,
  },
  "gpt-5-nano": {
    inputToken: 0.05 / 1_000_000,
    outputToken: 0.4 / 1_000_000,
  },
};

export function calculateTotalCost(usage: TokenUsage[]): number {
  const totalsByModel = usage.reduce(
    (acc, entry) => {
      if (!acc[entry.model]) {
        acc[entry.model] = { input: 0, output: 0 };
      }
      acc[entry.model].input += entry.inputTokens;
      acc[entry.model].output += entry.outputTokens;
      return acc;
    },
    {} as Record<string, { input: number; output: number }>,
  );

  return Object.entries(totalsByModel).reduce((cost, [model, tokens]) => {
    const pricing = TOKEN_PRICING[model];
    if (!pricing) return cost;
    return (
      cost +
      tokens.input * pricing.inputToken +
      tokens.output * pricing.outputToken
    );
  }, 0);
}
