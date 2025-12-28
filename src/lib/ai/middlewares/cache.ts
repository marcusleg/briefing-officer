import type {
  LanguageModelV2Middleware,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import QuickLRU from "quick-lru";

const sevenDaysInMilliseconds = 1000 * 60 * 60 * 24 * 7;
const cache = new QuickLRU<string, string>({
  maxSize: 1000,
  maxAge: sevenDaysInMilliseconds,
});

export const cacheMiddleware: LanguageModelV2Middleware = {
  wrapStream: async ({ doStream, params }) => {
    const cacheKey = JSON.stringify(params);

    if (cache.has(cacheKey)) {
      const id = "0";

      const chunks: LanguageModelV2StreamPart[] = [
        { type: "text-start", id },
        { type: "text-delta", id, delta: cache.get(cacheKey)!! },
        { type: "text-end", id },
      ];

      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks,
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

    return {
      stream: result.stream.pipeThrough(transformStream),
      request: result.request,
      response: result.response,
    };
  },
};
