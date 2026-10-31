import prisma from "@/lib/prismaClient";

/**
 * Deliberately not `"use server"`: an exported function there becomes a server
 * action a client could call with any `userId`, crediting usage to whoever it
 * likes. Only the generation services, which have already established whose
 * article they are working on, may call this.
 */
export const trackTokenUsage = async (
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
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
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
    },
  });
};
