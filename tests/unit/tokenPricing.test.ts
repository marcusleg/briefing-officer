import { calculateTotalCost, TOKEN_PRICING } from "@/lib/ai/tokenPricing";
import { TokenUsage } from "@prisma/client";
import { describe, expect, it } from "vitest";

const u = (model: string, input: number, output: number): TokenUsage => ({
  userId: "u",
  date: "2026-06-05",
  model,
  inputTokens: input,
  outputTokens: output,
  reasoningTokens: 0,
});

describe("TOKEN_PRICING", () => {
  it("includes the four known model entries", () => {
    expect(TOKEN_PRICING["claude-sonnet-4-20250514"]).toEqual({
      inputToken: 3 / 1_000_000,
      outputToken: 15 / 1_000_000,
    });
    expect(TOKEN_PRICING["gpt-4.1-nano"]).toEqual({
      inputToken: 0.1 / 1_000_000,
      outputToken: 0.4 / 1_000_000,
    });
    expect(TOKEN_PRICING["gpt-4.1-mini"]).toEqual({
      inputToken: 0.15 / 1_000_000,
      outputToken: 0.6 / 1_000_000,
    });
    expect(TOKEN_PRICING["gpt-5-nano"]).toEqual({
      inputToken: 0.05 / 1_000_000,
      outputToken: 0.4 / 1_000_000,
    });
  });
});

describe("calculateTotalCost", () => {
  it("returns 0 for empty usage", () => {
    expect(calculateTotalCost([])).toBe(0);
  });

  it("sums input + output cost for a known model", () => {
    const cost = calculateTotalCost([u("gpt-4.1-nano", 1_000_000, 500_000)]);
    expect(cost).toBeCloseTo(0.3, 10);
  });

  it("ignores unknown models without throwing", () => {
    expect(calculateTotalCost([u("mystery-model", 1_000_000, 1_000_000)])).toBe(
      0,
    );
  });

  it("mixes known + unknown models correctly", () => {
    const cost = calculateTotalCost([
      u("gpt-4.1-nano", 1_000_000, 500_000),
      u("mystery-model", 9_999_999, 9_999_999),
    ]);
    expect(cost).toBeCloseTo(0.3, 10);
  });

  it("sums across multiple entries of the same model", () => {
    const cost = calculateTotalCost([
      u("gpt-4.1-nano", 500_000, 250_000),
      u("gpt-4.1-nano", 500_000, 250_000),
    ]);
    expect(cost).toBeCloseTo(0.3, 10);
  });
});
