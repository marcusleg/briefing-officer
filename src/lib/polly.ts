"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import * as fs from "node:fs";

const client = new PollyClient();

export const getSpeechSynthesis = async (feedId: number, articleId: number) => {
  logger.debug({ feedId, articleId }, "Synthesizing speech");

  let filePath = `./public/tts/${articleId}.ogg`;

  if (fs.existsSync(filePath)) {
    logger.debug(
      { filePath, article: { id: articleId, feedId } },
      "Speech already synthesized.",
    );
    return;
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: articleId,
    },
  });
  const scrape = await prisma.articleScrape.findUniqueOrThrow({
    where: { articleId: articleId },
  });

  const command = new SynthesizeSpeechCommand({
    Engine: "generative",
    LanguageCode: "en-US",
    OutputFormat: "ogg_vorbis",
    Text: `${article.title}. ${scrape.textContent}`,
    VoiceId: "Ruth",
  });
  const response = await client.send(command);

  if (!response.AudioStream) {
    throw new Error("Failed to generate speech");
  }

  const writeableStream = fs.createWriteStream(filePath);
  writeableStream.write(
    Buffer.from(await response.AudioStream.transformToByteArray()),
  );

  logger.info(
    { filePath, article: { id: articleId, feedId } },
    "Synthesized speech.",
  );
};
