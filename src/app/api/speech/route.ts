import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { generateSpeech } from "ai";
import { headers } from "next/headers";

// Briefing sentences are far shorter. The cap keeps the route from serving as
// a general-purpose TTS proxy for signed-in users, and is large enough that a
// script that arrived without line breaks can still be read as one clip. It
// matches the input limit of OpenAI's TTS API.
const MAX_TEXT_LENGTH = 4096;

// Article ids are 32-bit integers in the database.
const MAX_ARTICLE_ID = 2147483647;

const textResponse = (text: string, status: number) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const parseBody = async (
  request: Request,
): Promise<{ articleId: number; text: string } | null> => {
  const body = (await request.json().catch(() => null)) as {
    articleId?: unknown;
    text?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  const articleId = body?.articleId;

  if (
    typeof articleId !== "number" ||
    !Number.isSafeInteger(articleId) ||
    articleId <= 0 ||
    articleId > MAX_ARTICLE_ID ||
    text === "" ||
    text.length > MAX_TEXT_LENGTH
  ) {
    return null;
  }

  return { articleId, text };
};

/** Synthesizes one sentence of an article's audio briefing as mp3. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return textResponse("Sign in to listen.", 401);
  }

  const body = await parseBody(request);
  if (!body) {
    return textResponse("Invalid speech request.", 400);
  }

  const article = await prisma.article.findUnique({
    where: { id: body.articleId, userId: session.user.id },
    select: { language: true },
  });
  if (!article) {
    return textResponse("Article not found.", 404);
  }

  // The language comes from the stored article, never from the client, so a
  // voice only ever reads the languages it was configured for.
  const speech = getSpeechModelFor(article.language);
  if (!speech) {
    return textResponse(
      "No speech voice is configured for this article's language.",
      422,
    );
  }

  try {
    const { audio } = await generateSpeech({
      model: speech.model,
      voice: speech.voice,
      text: body.text,
      outputFormat: "mp3",
      maxRetries: 1,
      abortSignal: request.signal,
    });

    // Copied into a fresh Uint8Array so its buffer is a plain ArrayBuffer,
    // which is what BodyInit accepts.
    return new Response(new Uint8Array(audio.uint8Array), {
      headers: {
        "Content-Type": audio.mediaType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (!request.signal.aborted) {
      logger.error(
        { err: error, articleId: body.articleId },
        "Speech synthesis failed.",
      );
    }
    return textResponse("The speech service failed.", 502);
  }
}
