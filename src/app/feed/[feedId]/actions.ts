"use server";
import prisma from "@/lib/prismaClient";
import { revalidatePath } from "next/cache";

export const markArticleAsRead = async (articleId: number) => {
  const updatedArticle = await prisma.article.update({
    where: {
      id: articleId,
    },
    data: {
      read: true,
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
      read: false,
    },
  });

  revalidatePath(`/feed/${updatedArticle.feedId}`);
  revalidatePath("/");
};
