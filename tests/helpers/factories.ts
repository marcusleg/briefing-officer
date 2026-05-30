import prisma from "@/lib/prismaClient";
import { randomUUID } from "crypto";

export const createUser = (
  overrides: Partial<{ id: string; name: string; email: string }> = {},
) => {
  const id = overrides.id ?? randomUUID();
  return prisma.user.create({
    data: {
      id,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const createCategory = (overrides: {
  userId: string;
  name?: string;
}) => {
  return prisma.feedCategory.create({
    data: {
      userId: overrides.userId,
      name: overrides.name ?? "Category",
    },
  });
};

export const createFeed = (overrides: {
  userId: string;
  title?: string;
  link?: string;
  autoRefresh?: boolean;
  titleFilterExpressions?: string;
  feedCategoryId?: number | null;
}) => {
  return prisma.feed.create({
    data: {
      userId: overrides.userId,
      title: overrides.title ?? "Test Feed",
      link: overrides.link ?? `https://example.com/${randomUUID()}.xml`,
      autoRefresh: overrides.autoRefresh ?? true,
      titleFilterExpressions: overrides.titleFilterExpressions ?? "",
      lastFetched: new Date(0),
      feedCategoryId: overrides.feedCategoryId ?? null,
    },
  });
};

export const createArticle = (overrides: {
  userId: string;
  feedId: number;
  title?: string;
  link?: string;
  publicationDate?: Date;
  readAt?: Date | null;
  readLater?: boolean;
  starred?: boolean;
}) => {
  return prisma.article.create({
    data: {
      userId: overrides.userId,
      feedId: overrides.feedId,
      title: overrides.title ?? "Test Article",
      link: overrides.link ?? `https://example.com/article/${randomUUID()}`,
      publicationDate: overrides.publicationDate ?? new Date(),
      readAt: overrides.readAt ?? null,
      readLater: overrides.readLater ?? false,
      starred: overrides.starred ?? false,
    },
  });
};
