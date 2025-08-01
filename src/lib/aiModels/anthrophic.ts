"use server";

import { createAnthropic } from "@ai-sdk/anthropic";

const apiKey = process.env.ANTHROPIC_API_KEY;

const isProviderConfigured = !!apiKey;

export const anthropicClaude = async () => {
  if (!isProviderConfigured) {
    return Promise.reject("Anthropic is not configured");
  }

  const anthropic = createAnthropic({ apiKey });

  return anthropic("claude-opus-4-20250514");
};
