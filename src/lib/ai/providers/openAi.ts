"use server";

import { AiLanguageModelFactory } from "@/lib/ai/types";
import { createOpenAI } from "@ai-sdk/openai";

const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;

const openAiModel: AiLanguageModelFactory = async () => ({
  isConfigured: !!apiKey && !!model,
  create: async () => {
    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    return openai(model!);
  },
});

export default openAiModel;
