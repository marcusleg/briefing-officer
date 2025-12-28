import { cacheMiddleware } from "@/lib/ai/middlewares/cache";
import anthropicModel from "@/lib/ai/providers/anthropic";
import azureOpenAiModel from "@/lib/ai/providers/azureOpenAi";
import { wrapLanguageModel } from "ai";

const languageModels = [anthropicModel, azureOpenAiModel];

export const getFirstConfiguredLanguageModel = async () => {
  const factory = await Promise.all(languageModels.map((factory) => factory()));
  const firstConfiguredFactory = factory.find(
    (factory) => factory.isConfigured,
  );

  if (!firstConfiguredFactory) {
    throw new Error("No AI language model is configured.");
  }

  const baseLanguageModel = await firstConfiguredFactory.create();

  return wrapLanguageModel({
    model: baseLanguageModel,
    middleware: [cacheMiddleware],
  });
};
