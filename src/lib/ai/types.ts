import { LanguageModelV4, SpeechModelV4 } from "@ai-sdk/provider";

interface AiLanguageModel {
  isConfigured: boolean;
  create: () => Promise<LanguageModelV4>;
}

export type AiLanguageModelFactory = () => Promise<AiLanguageModel>;

interface AiSpeechModel {
  isConfigured: boolean;
  /** ISO 639-1 codes of the article languages this voice may read. */
  languages: string[];
  voice: string;
  create: () => SpeechModelV4;
}

/**
 * Synchronous, unlike the language-model factory: it reads the environment on
 * every call so the page and the route always agree with the current config.
 */
export type AiSpeechModelFactory = () => AiSpeechModel;
