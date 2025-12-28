"use server";

import prisma from "@/lib/prismaClient";

export const trackTokenUsage = async (
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  reasoningTokens: number,
) => {
  const date = new Date().toISOString().split("T")[0];

  await prisma.tokenUsage.upsert({
    where: {
      userId_date_model: {
        userId,
        date,
        model: model,
      },
    },
    create: {
      userId,
      date,
      model: model,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      reasoningTokens: reasoningTokens,
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      reasoningTokens: { increment: reasoningTokens },
    },
  });
};
