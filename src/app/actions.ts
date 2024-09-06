"use server";

import { revalidatePath } from "next/cache";
import prisma from "../lib/prismaClient";

export const markArticlesOlderThanXDaysAsRead = async (
  feedId: number,
  days: number,
) => {
  const date = new Date();
  date.setDate(date.getDate() - days);

  await prisma.article.updateMany({
    where: { feedId: feedId, publicationDate: { lte: date } },
    data: { readAt: new Date() },
  });

  revalidatePath(`/feed/${feedId}`);
  revalidatePath("/");
};
