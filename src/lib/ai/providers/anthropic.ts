import { AiLanguageModelFactory } from "@/lib/ai/types";
import { createAnthropic } from "@ai-sdk/anthropic";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL;

const anthropicModel: AiLanguageModelFactory = async () => ({
  isConfigured: !!apiKey && !!model,
  create: async () => {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(model!);
  },
});

export default anthropicModel;
