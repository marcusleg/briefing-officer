"use server";
import prisma from "@/lib/prismaClient";
import { revalidatePath } from "next/cache";

export const markArticleAsRead = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/");
};

export const markArticleAsUnread = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      readAt: null,
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/");
};
