import { LanguageModelV4 } from "@ai-sdk/provider";

interface AiLanguageModel {
  isConfigured: boolean;
  create: () => Promise<LanguageModelV4>;
}

export type AiLanguageModelFactory = () => Promise<AiLanguageModel>;
