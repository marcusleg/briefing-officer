import { systemPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import { trackTokenUsage } from "@/lib/ai/services/tokenUsageService";
import logger from "@/lib/logger";
import { createStreamableValue } from "@ai-sdk/rsc";
import { streamText } from "ai";

const model = await getFirstConfiguredLanguageModel();

/**
 * Streams a prompt to the reader, then logs and bills what it cost.
 *
 * Not a server action itself — the `"use server"` services that wrap this one
 * are. Keeping the streaming here means the failure handling below exists once
 * rather than once per generation type.
 */
export const streamGeneration = ({
  prompt,
  userId,
  label,
  context,
}: {
  prompt: string;
  userId: string;
  /** Names the generation in log messages, e.g. "Audio script". */
  label: string;
  /** Extra fields to attach to every log line for this generation. */
  context: Record<string, unknown>;
}) => {
  const stream = createStreamableValue("");
  const { textStream, totalUsage } = streamText({
    model,
    system: systemPrompt,
    prompt,
  });

  void (async () => {
    try {
      for await (const delta of textStream) {
        stream.update(delta);
      }
      stream.done();
    } catch (error) {
      // Hand the failure to the reader rather than leaving the stream open.
      // readStreamableValue() rethrows it inside the client's `for await`,
      // where the surrounding catch can surface it; without this the value
      // never settles and that loop waits forever.
      stream.error(error);
      logger.error(
        { err: error, ...context, model: model.modelId },
        `${label} generation failed.`,
      );
      return;
    }

    try {
      const tokenUsage = await totalUsage;

      logger.info(
        { ...context, model: model.modelId, tokenUsage },
        `${label} generated.`,
      );

      await trackTokenUsage(
        userId,
        model.modelId,
        tokenUsage.inputTokens ?? 0,
        tokenUsage.outputTokens ?? 0,
      );
    } catch (error) {
      // Awaited separately because it rejects on its own: a provider error
      // reaches the caller as a stream part rather than a throw, so the loop
      // above can finish normally and still leave no usage to report. The text
      // has already been delivered, so only the accounting is lost.
      logger.error(
        { err: error, ...context, model: model.modelId },
        `${label} token usage unavailable.`,
      );
    }
  })();

  return { output: stream.value };
};
