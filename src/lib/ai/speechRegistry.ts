import openAiSpeechModel from "@/lib/ai/speech-providers/openAi";
import { DEFAULT_LANGUAGE } from "@/lib/language";
import type { SpeechModelV4 } from "@ai-sdk/provider";

const speechModels = [openAiSpeechModel];

export interface ConfiguredSpeechModel {
  model: SpeechModelV4;
  voice: string;
}

/**
 * The speech model that should read an article in `language`, or undefined
 * when none is configured for it and the browser's own voices read it instead.
 */
export const getSpeechModelFor = (
  language: string | null,
): ConfiguredSpeechModel | undefined => {
  const spoken = language ?? DEFAULT_LANGUAGE;
  const provider = speechModels
    .map((factory) => factory())
    .find(
      (candidate) =>
        candidate.isConfigured && candidate.languages.includes(spoken),
    );

  return provider && { model: provider.create(), voice: provider.voice };
};
