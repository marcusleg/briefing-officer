"use server";

import { AiLanguageModelFactory } from "@/lib/ai/types";
import { createAzure } from "@ai-sdk/azure";

const apiKey = process.env.AZURE_OPENAI_API_KEY;
const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
const model = process.env.AZURE_OPENAI_MODEL;

const azureOpenAiModel: AiLanguageModelFactory = async () => ({
  isConfigured: !!apiKey && !!model && !!resourceName,
  create: async () => {
    const azureOpenAi = createAzure({ apiKey, resourceName });
    return azureOpenAi(model!);
  },
});

export default azureOpenAiModel;
