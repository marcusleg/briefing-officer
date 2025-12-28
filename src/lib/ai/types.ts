import { LanguageModelV2 } from "@ai-sdk/provider";

interface AiLanguageModel {
  isConfigured: boolean;
  create: () => Promise<LanguageModelV2>;
}

export type AiLanguageModelFactory = () => Promise<AiLanguageModel>;
