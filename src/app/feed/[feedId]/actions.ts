"use server";
import prisma from "@/lib/prismaClient";
import { revalidatePath } from "next/cache";

export const markArticleAsRead = async (feedId: number, articleId: number) => {
  await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      read: true,
    },
  });

  revalidatePath(`/feed/${feedId}`);
};

export const markArticleAsUnread = async (
  feedId: number,
  articleId: number,
) => {
  await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      read: false,
    },
  });

  revalidatePath(`/feed/${feedId}`);
};
