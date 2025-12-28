import { LanguageModelV3 } from "@ai-sdk/provider";

interface AiLanguageModel {
  isConfigured: boolean;
  create: () => Promise<LanguageModelV3>;
}

export type AiLanguageModelFactory = () => Promise<AiLanguageModel>;
