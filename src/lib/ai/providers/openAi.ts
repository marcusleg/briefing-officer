"use server";

import { AiLanguageModelFactory } from "@/lib/ai/types";
import { createOpenAI } from "@ai-sdk/openai";

const customBaseUrl = process.env.OPENAI_BASE_URL;
const baseUrl = customBaseUrl ?? "https://api.openai.com/v1";
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;

const openAiModel: AiLanguageModelFactory = async () => ({
  isConfigured: !!apiKey && !!model,
  create: async () => {
    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    // OpenAI-compatible services implement Chat Completions reliably but the
    // Responses API only partly: one router streams tool-call arguments in a
    // shape the SDK rejects, which broke the chat's searches mid-answer.
    return customBaseUrl ? openai.chat(model!) : openai(model!);
  },
});

export default openAiModel;
