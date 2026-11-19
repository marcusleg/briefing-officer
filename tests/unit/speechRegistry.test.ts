import { parseSpeechLanguages } from "@/lib/ai/speech-providers/openAi";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { generateSpeech } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TTS_VARIABLES = [
  "OPENAI_TTS_BASE_URL",
  "OPENAI_TTS_API_KEY",
  "OPENAI_TTS_MODEL",
  "OPENAI_TTS_VOICE",
  "OPENAI_TTS_LANGUAGES",
];

const configure = (env: Record<string, string>) => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
};

beforeEach(() => {
  // Start every test from "nothing configured", including the language-model
  // variables the SDK would otherwise fall back to.
  for (const name of [...TTS_VARIABLES, "OPENAI_BASE_URL", "OPENAI_API_KEY"]) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseSpeechLanguages", () => {
  it("defaults to English when unset or empty", () => {
    expect(parseSpeechLanguages(undefined)).toEqual(["en"]);
    expect(parseSpeechLanguages("")).toEqual(["en"]);
    expect(parseSpeechLanguages(" , ")).toEqual(["en"]);
  });

  it("trims, lowercases and drops empty entries", () => {
    expect(parseSpeechLanguages(" EN, de ,,")).toEqual(["en", "de"]);
  });
});

describe("getSpeechModelFor", () => {
  it.each<Record<string, string>>([
    { OPENAI_TTS_MODEL: "kokoro-latest" },
    { OPENAI_TTS_VOICE: "af_heart" },
    {},
  ])("is undefined unless model and voice are both set (%o)", (env) => {
    configure(env);

    expect(getSpeechModelFor("en")).toBeUndefined();
  });

  it("returns the configured model and voice for a covered language", () => {
    configure({
      OPENAI_TTS_MODEL: "kokoro-latest",
      OPENAI_TTS_VOICE: "af_heart",
    });

    const speech = getSpeechModelFor("en");

    expect(speech?.model.modelId).toBe("kokoro-latest");
    expect(speech?.voice).toBe("af_heart");
  });

  it("is undefined for a language the voice does not cover", () => {
    configure({
      OPENAI_TTS_MODEL: "kokoro-latest",
      OPENAI_TTS_VOICE: "af_heart",
    });

    expect(getSpeechModelFor("de")).toBeUndefined();
  });

  it("treats an unknown article language as the default language", () => {
    configure({
      OPENAI_TTS_MODEL: "kokoro-latest",
      OPENAI_TTS_VOICE: "af_heart",
    });

    expect(getSpeechModelFor(null)).toBeDefined();
  });

  it("covers exactly the configured languages", () => {
    configure({
      OPENAI_TTS_MODEL: "tts",
      OPENAI_TTS_VOICE: "voice",
      OPENAI_TTS_LANGUAGES: "de, FR",
    });

    expect(getSpeechModelFor("de")).toBeDefined();
    expect(getSpeechModelFor("fr")).toBeDefined();
    expect(getSpeechModelFor("en")).toBeUndefined();
  });

  describe("requests", () => {
    const captureFetch = () => {
      const fetch = vi.fn(
        async (_url: string, _init?: RequestInit) =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "audio/mpeg" },
          }),
      );
      vi.stubGlobal("fetch", fetch);
      return fetch;
    };

    const synthesize = async () => {
      const speech = getSpeechModelFor("en")!;
      await generateSpeech({
        model: speech.model,
        voice: speech.voice,
        text: "Hello.",
        maxRetries: 0,
      });
    };

    it("goes to the TTS base URL with the TTS key", async () => {
      configure({
        OPENAI_TTS_BASE_URL: "https://tts.example/v1",
        OPENAI_TTS_API_KEY: "tts-key",
        OPENAI_TTS_MODEL: "kokoro-latest",
        OPENAI_TTS_VOICE: "af_heart",
      });
      const fetch = captureFetch();

      await synthesize();

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe("https://tts.example/v1/audio/speech");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer tts-key",
      );
    });

    it("never falls back to the language model's base URL or key", async () => {
      configure({
        OPENAI_BASE_URL: "https://llm.example/v1",
        OPENAI_API_KEY: "llm-secret",
        OPENAI_TTS_MODEL: "tts-1",
        OPENAI_TTS_VOICE: "alloy",
      });
      const fetch = captureFetch();

      await synthesize();

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/audio/speech");
      expect(new Headers(init?.headers).get("authorization")).not.toContain(
        "llm-secret",
      );
    });
  });
});
