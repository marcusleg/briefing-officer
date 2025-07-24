import type {
  LanguageModelV2Middleware,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";

// TODO this cache has no size limit or time-to-live. Fix that!
const cache = new Map<string, any>();

export const cacheMiddleware: LanguageModelV2Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    const cacheKey = JSON.stringify(params);

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const result = await doGenerate();

    cache.set(cacheKey, result);

    return result;
  },
  wrapStream: async ({ doStream, params }) => {
    const cacheKey = JSON.stringify(params);
    console.log(cacheKey);

    if (cache.has(cacheKey)) {
      const bla: LanguageModelV2StreamPart[] = [
        { type: "text-start", id: "0" },
        { type: "text-delta", id: "0", delta: cache.get(cacheKey) },
        { type: "text-end", id: "0" },
      ];

      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: bla,
        }),
      };
    }

    const result = await doStream();

    let generatedText = "";
    const textBlocks = new Map<string, string>();

    const transformStream = new TransformStream<
      LanguageModelV2StreamPart,
      LanguageModelV2StreamPart
    >({
      transform(chunk, controller) {
        switch (chunk.type) {
          case "text-start": {
            textBlocks.set(chunk.id, "");
            break;
          }
          case "text-delta": {
            const existing = textBlocks.get(chunk.id) || "";
            textBlocks.set(chunk.id, existing + chunk.delta);
            generatedText += chunk.delta;
            break;
          }
          case "text-end": {
            break;
          }
        }

        controller.enqueue(chunk);
      },

      flush() {
        cache.set(cacheKey, generatedText);
      },
    });
    cache.set(cacheKey, result);

    return {
      stream: result.stream.pipeThrough(transformStream),
      request: result.request,
      response: result.response,
    };
  },
};
