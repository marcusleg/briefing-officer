import type { AiSpeechModelFactory } from "@/lib/ai/types";
import { DEFAULT_LANGUAGE } from "@/lib/language";
import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Parses `OPENAI_TTS_LANGUAGES`. Many TTS models speak only some languages,
 * so the voice reads an article only when its language is listed here.
 */
export const parseSpeechLanguages = (value: string | undefined): string[] => {
  const languages = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");

  return languages.length > 0 ? languages : [DEFAULT_LANGUAGE];
};

const openAiSpeechModel: AiSpeechModelFactory = () => {
  const model = process.env.OPENAI_TTS_MODEL;
  const voice = process.env.OPENAI_TTS_VOICE;

  return {
    // No API key required: local TTS services often run without one.
    isConfigured: !!model && !!voice,
    languages: parseSpeechLanguages(process.env.OPENAI_TTS_LANGUAGES),
    voice: voice ?? "",
    create: () =>
      // Both settings are passed explicitly. Left undefined, the SDK reads
      // OPENAI_BASE_URL and OPENAI_API_KEY, which would send the language
      // model's credentials to the TTS service.
      createOpenAI({
        baseURL: process.env.OPENAI_TTS_BASE_URL || DEFAULT_BASE_URL,
        apiKey: process.env.OPENAI_TTS_API_KEY ?? "",
      }).speech(model!),
  };
};

export default openAiSpeechModel;
