import anthropicModel from "@/lib/ai/providers/anthropic";
import azureOpenAiModel from "@/lib/ai/providers/azureOpenAi";

const languageModels = [anthropicModel, azureOpenAiModel];

export const getFirstConfiguredLanguageModel = async () => {
  const factory = await Promise.all(languageModels.map((factory) => factory()));
  const firstConfiguredFactory = factory.find(
    (factory) => factory.isConfigured,
  );

  if (!firstConfiguredFactory) {
    throw new Error("No AI language model is configured.");
  }

  return firstConfiguredFactory.create();
};
