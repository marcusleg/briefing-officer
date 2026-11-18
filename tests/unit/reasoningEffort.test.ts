import {
  parseReasoningEffort,
  withReasoningEffort,
} from "@/lib/ai/reasoningEffort";
import logger from "@/lib/logger";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  LanguageModelV4,
  LanguageModelV4GenerateResult,
} from "@ai-sdk/provider";
import { generateText, streamText } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

describe("parseReasoningEffort", () => {
  it("leaves the effort to the provider when unset or empty", () => {
    expect(parseReasoningEffort(undefined)).toBe("provider-default");
    expect(parseReasoningEffort("")).toBe("provider-default");
    expect(parseReasoningEffort("   ")).toBe("provider-default");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    "provider-default",
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ])("accepts %s", (level) => {
    expect(parseReasoningEffort(level)).toBe(level);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("ignores case and surrounding whitespace", () => {
    expect(parseReasoningEffort("  High \n")).toBe("high");
  });

  it("falls back to the provider default and warns on an unknown level", () => {
    expect(parseReasoningEffort("hgih")).toBe("provider-default");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ value: "hgih" }),
      expect.stringContaining("AI_REASONING_EFFORT"),
    );
  });
});

const generateResult: LanguageModelV4GenerateResult = {
  content: [{ type: "text", text: "Hello." }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: {
      total: 3,
      noCache: 3,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 2, text: 2, reasoning: undefined },
  },
  warnings: [],
};

const mockModel = () =>
  new MockLanguageModelV4({
    modelId: "test-model",
    doGenerate: generateResult,
    doStream: {
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "1" },
        { type: "text-delta", id: "1", delta: "Hello." },
        { type: "text-end", id: "1" },
        {
          type: "finish",
          finishReason: generateResult.finishReason,
          usage: generateResult.usage,
        },
      ]),
    },
  });

describe("withReasoningEffort", () => {
  it("keeps the model ID used for logging and billing", () => {
    expect(withReasoningEffort(mockModel(), "low").modelId).toBe("test-model");
  });

  it("sends the effort with generated responses", async () => {
    const model = mockModel();

    await generateText({
      model: withReasoningEffort(model, "low"),
      prompt: "Hi.",
    });

    expect(model.doGenerateCalls[0].reasoning).toBe("low");
  });

  it("sends the effort with streamed responses", async () => {
    const model = mockModel();

    const { text } = streamText({
      model: withReasoningEffort(model, "high"),
      prompt: "Hi.",
    });
    await text;

    expect(model.doStreamCalls[0].reasoning).toBe("high");
  });

  it("lets a call that sets its own effort override the default", async () => {
    const model = mockModel();

    await generateText({
      model: withReasoningEffort(model, "low"),
      prompt: "Hi.",
      reasoning: "none",
    });

    expect(model.doGenerateCalls[0].reasoning).toBe("none");
  });
});

describe("withReasoningEffort on the wire", () => {
  // Captures the request body, then fails the call: the body is all we need.
  const captureBody = () => {
    const captured: { body?: Record<string, any> } = {};
    const fetch = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      throw new Error("captured");
    }) as typeof globalThis.fetch;
    return { captured, fetch };
  };

  const send = async (
    model: LanguageModelV4,
    system?: string,
  ): Promise<void> => {
    await expect(
      generateText({ model, system, prompt: "Hi.", maxRetries: 0 }),
    ).rejects.toThrow();
  };

  it("sends the effort to OpenAI for a model ID the SDK does not recognize", async () => {
    const { captured, fetch } = captureBody();
    const openai = createOpenAI({ apiKey: "test", fetch });

    await send(withReasoningEffort(openai("my-proxy-alias"), "low"));

    expect(captured.body?.reasoning?.effort).toBe("low");
  });

  it("sends the effort to Azure for a custom deployment name", async () => {
    const { captured, fetch } = captureBody();
    const azure = createAzure({ apiKey: "test", resourceName: "test", fetch });

    await send(withReasoningEffort(azure("my-deployment"), "low"));

    expect(captured.body?.reasoning?.effort).toBe("low");
  });

  it("leaves the request untouched on the provider default", async () => {
    const { captured, fetch } = captureBody();
    const openai = createOpenAI({ apiKey: "test", fetch });

    await send(
      withReasoningEffort(openai("my-proxy-alias"), "provider-default"),
      "Be brief.",
    );

    expect(captured.body).not.toHaveProperty("reasoning");
    expect(captured.body?.input[0].role).toBe("system");
  });

  it("keeps the provider options a call sets next to the forced one", async () => {
    const model = mockModel();

    await generateText({
      model: withReasoningEffort(model, "low"),
      prompt: "Hi.",
      providerOptions: { openai: { user: "someone" } },
    });

    expect(model.doGenerateCalls[0].providerOptions?.openai).toEqual({
      forceReasoning: true,
      user: "someone",
    });
  });
});
