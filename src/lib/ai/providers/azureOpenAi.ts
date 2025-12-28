"use server";

import { AiLanguageModelFactory } from "@/lib/ai/types";
import { createAzure } from "@ai-sdk/azure";

const apiKey = process.env.AZURE_OPENAI_API_KEY;
const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;

const azureOpenAiModel: AiLanguageModelFactory = async () => ({
  isConfigured: !!apiKey && !!resourceName,
  create: async () => {
    const azureOpenAi = createAzure({ apiKey, resourceName });
    return azureOpenAi("gpt-5-nano");
  },
});

export default azureOpenAiModel;
