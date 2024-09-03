"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import * as fs from "node:fs";

const client = new PollyClient();

export const getSpeechSynthesis = async (feedId: number, articleId: number) => {
  logger.debug({ feedId, articleId }, "Synthesizing speech");

  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: articleId,
    },
  });
  const readability = await prisma.articleReadability.findUniqueOrThrow({
    where: { articleId: articleId },
  });

  const command = new SynthesizeSpeechCommand({
    Engine: "generative",
    LanguageCode: "en-US",
    OutputFormat: "ogg_vorbis",
    Text: `${article.title}. ${readability.textContent}`,
    VoiceId: "Ruth",
  });
  const response = await client.send(command);

  if (!response.AudioStream) {
    throw new Error("Failed to generate speech");
  }

  const writeableStream = fs.createWriteStream(
    `./data/speech-${feedId}-${articleId}.ogg`,
  );
  writeableStream.write(
    Buffer.from(await response.AudioStream.transformToByteArray()),
  );
};
