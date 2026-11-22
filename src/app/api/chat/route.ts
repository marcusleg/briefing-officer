import { getArticleForUser } from "@/lib/ai/chat/articleTools";
import {
  compactEarlierTurns,
  declineStaleApprovals,
} from "@/lib/ai/chat/compactHistory";
import { createChatTools, type ChatUIMessage } from "@/lib/ai/chat/tools";
import { buildChatSystemPrompt, buildFollowUpPrompt } from "@/lib/ai/prompts";
import { getFirstConfiguredLanguageModel } from "@/lib/ai/registry";
import { trackTokenUsage } from "@/lib/ai/services/tokenUsageService";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import { headers } from "next/headers";
import { z } from "zod";

const MAX_STEPS = 10;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const parseBody = (
  text: string,
): { messages?: unknown; articleId?: unknown } | null => {
  try {
    return JSON.parse(text) as {
      messages?: unknown;
      articleId?: unknown;
    } | null;
  } catch {
    return null;
  }
};

const isTextOnlyOrAssistant = (message: ChatUIMessage) =>
  message.role !== "user" ||
  message.parts.every((part) => part.type === "text");

const textResponse = (text: string, status: number) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return textResponse("Sign in to chat.", 401);
  }
  const userId = session.user.id;

  // The cap bounds what is parsed and sent to the model. A chunked body has no
  // Content-Length, so it is buffered before the size check; acceptable, as
  // only signed-in readers get this far.
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) {
    return textResponse("Chat request too large.", 413);
  }
  const text = await request.text().catch(() => "");
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return textResponse("Chat request too large.", 413);
  }

  const body = parseBody(text);
  const tools = createChatTools(userId);
  const validation = await safeValidateUIMessages<ChatUIMessage>({
    messages: body?.messages,
    tools,
  });
  // The UI only sends text. A file part would be passed to the provider, and
  // a URL in it downloaded by the server.
  if (!validation.success || !validation.data.every(isTextOnlyOrAssistant)) {
    return textResponse("Invalid chat request.", 400);
  }

  // PROTOTYPE: a chat opened from an article carries its id on every request,
  // so follow-ups stay grounded in it.
  let article;
  if (body?.articleId !== undefined) {
    if (!Number.isInteger(body.articleId)) {
      return textResponse("Invalid chat request.", 400);
    }
    const found = await getArticleForUser(userId, body.articleId as number);
    if ("error" in found) {
      return textResponse("Article not found.", 404);
    }
    const language = (
      await prisma.article.findUniqueOrThrow({
        where: { id: found.id },
        select: { language: true },
      })
    ).language;
    article = { ...found, language };
  }

  let model;
  try {
    model = await getFirstConfiguredLanguageModel();
  } catch (error) {
    logger.error({ err: error }, "Chat unavailable: no AI provider.");
    return textResponse("No AI provider is configured.", 503);
  }

  const context = { userId, model: model.modelId };

  const record = async (usage: {
    inputTokens: number;
    outputTokens: number;
  }) => {
    try {
      logger.info(
        { ...context, tokenUsage: usage },
        "Chat step usage recorded.",
      );
      await trackTokenUsage(
        userId,
        model.modelId,
        usage.inputTokens,
        usage.outputTokens,
      );
    } catch (error) {
      logger.error(
        { err: error, ...context },
        "Chat token usage not recorded.",
      );
    }
  };

  const result = streamText({
    model,
    instructions: buildChatSystemPrompt({ today: new Date(), article }),
    messages: await convertToModelMessages(
      compactEarlierTurns(declineStaleApprovals(validation.data)),
      { tools },
    ),
    tools,
    // The reader approves every status change in the chat before it runs; a
    // hostile article can make the model propose one, never apply it.
    toolApproval: { setArticleStatus: "user-approval" },
    stopWhen: stepCountIs(MAX_STEPS),
    abortSignal: request.signal,
    // The last allowed step cannot call tools, so the loop ends on text.
    prepareStep: ({ stepNumber }) =>
      stepNumber === MAX_STEPS - 1 ? { toolChoice: "none" } : {},
    // Recorded per step: a failure or Stop later on keeps what was used.
    onStepEnd: ({ usage }) =>
      record({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      }),
    onError: ({ error }) => {
      logger.error({ err: error, ...context }, "Chat generation failed.");
    },
  });

  const lastQuestion = validation.data
    .findLast((message) => message.role === "user")
    ?.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");

  // PROTOTYPE: once the answer is written, a second call proposes follow-up
  // questions, sent as a data part the client shows as buttons.
  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendFinish: false,
          onError: () => "The answer could not be generated. Please try again.",
        }),
      );

      let answer;
      try {
        answer = await result.text;
      } catch {
        return;
      }
      if (!answer.trim() || request.signal.aborted) {
        return;
      }
      try {
        const { object, usage } = await generateObject({
          model,
          schema: z.object({
            questions: z.array(z.string().min(1)).min(2).max(3),
          }),
          prompt: buildFollowUpPrompt(lastQuestion ?? "", answer),
          abortSignal: request.signal,
        });
        await record({
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        });
        writer.write({ type: "data-followUps", data: object });
      } catch (error) {
        logger.warn({ err: error, ...context }, "Follow-ups not generated.");
      }
      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
