import { AiLanguageModelFactory } from "@/lib/ai/types";
import { createAnthropic } from "@ai-sdk/anthropic";

const apiKey = process.env.ANTHROPIC_API_KEY;

const anthropicModel: AiLanguageModelFactory = async () => ({
  isConfigured: !!apiKey,
  create: async () => {
    const anthropic = createAnthropic({ apiKey });
    return anthropic("claude-sonnet-4-20250514");
  },
});

export default anthropicModel;
