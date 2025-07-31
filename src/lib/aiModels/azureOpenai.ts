"use server";

import { createAzure } from "@ai-sdk/azure";

const apiKey = process.env.AZURE_OPENAI_API_KEY;
const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;

const isProviderConfigured = apiKey && resourceName;

export const azureOpenAiChatGpt = async () => {
  if (!isProviderConfigured) {
    return Promise.reject("Azure OpenAI is not configured");
  }

  const azureOpenAi = createAzure({ apiKey, resourceName });

  return azureOpenAi("gpt-4.1-nano");
};
