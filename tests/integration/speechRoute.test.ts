import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/ai/speechRegistry", () => ({
  getSpeechModelFor: vi.fn(),
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateSpeech: vi.fn(),
}));

import { POST } from "@/app/api/speech/route";
import { getSpeechModelFor } from "@/lib/ai/speechRegistry";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { generateSpeech } from "ai";

const speechModel = { model: { modelId: "kokoro-latest" }, voice: "af_heart" };

const speechRequest = (body: unknown) =>
  new Request("http://localhost/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let userId: string;
let articleId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  const feed = await createFeed({ userId });
  const article = await createArticle({ userId, feedId: feed.id });
  await prisma.article.update({
    where: { id: article.id },
    data: { language: "en" },
  });
  articleId = article.id;

  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId },
  } as never);
  vi.mocked(getSpeechModelFor).mockReturnValue(speechModel as never);
  vi.mocked(generateSpeech).mockResolvedValue({
    audio: {
      uint8Array: new Uint8Array([1, 2, 3]),
      mediaType: "audio/mpeg",
      base64: "AQID",
      format: "mp3",
    },
    warnings: [],
    responses: [],
    providerMetadata: {},
  } as never);
});

describe("POST /api/speech", () => {
  it("returns the synthesized audio", async () => {
    const response = await POST(speechRequest({ articleId, text: " Hello. " }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(generateSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        model: speechModel.model,
        voice: "af_heart",
        text: "Hello.",
        outputFormat: "mp3",
        maxRetries: 1,
      }),
    );
  });

  it("picks the voice from the article's language, not the client", async () => {
    await prisma.article.update({
      where: { id: articleId },
      data: { language: "de" },
    });

    await POST(speechRequest({ articleId, text: "Hallo.", language: "en" }));

    expect(getSpeechModelFor).toHaveBeenCalledWith("de");
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST(speechRequest({ articleId, text: "Hello." }));

    expect(response.status).toBe(401);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it.each([
    { name: "empty text", body: () => ({ articleId, text: "   " }) },
    {
      name: "text over 4,096 characters",
      body: () => ({ articleId, text: "a".repeat(4097) }),
    },
    { name: "non-string text", body: () => ({ articleId, text: 42 }) },
    {
      name: "non-integer article id",
      body: () => ({ articleId: "1", text: "Hi." }),
    },
    {
      name: "article id beyond the safe integer range",
      body: () => ({ articleId: 1e20, text: "Hi." }),
    },
    {
      name: "article id of zero",
      body: () => ({ articleId: 0, text: "Hi." }),
    },
    { name: "malformed JSON", body: () => undefined },
  ])("returns 400 for $name", async ({ body }) => {
    const value = body();
    const request =
      value === undefined
        ? new Request("http://localhost/api/speech", {
            method: "POST",
            body: "{not json",
          })
        : speechRequest(value);

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's article", async () => {
    const otherUser = await createUser();
    const otherFeed = await createFeed({ userId: otherUser.id });
    const otherArticle = await createArticle({
      userId: otherUser.id,
      feedId: otherFeed.id,
    });

    const response = await POST(
      speechRequest({ articleId: otherArticle.id, text: "Hello." }),
    );

    expect(response.status).toBe(404);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("returns 422 when no voice covers the article's language", async () => {
    vi.mocked(getSpeechModelFor).mockReturnValue(undefined);

    const response = await POST(speechRequest({ articleId, text: "Hello." }));

    expect(response.status).toBe(422);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("returns 502 and logs when the speech service fails", async () => {
    vi.mocked(generateSpeech).mockRejectedValue(new Error("upstream down"));

    const response = await POST(speechRequest({ articleId, text: "Hello." }));

    expect(response.status).toBe(502);
    expect(logger.error).toHaveBeenCalled();
  });
});
