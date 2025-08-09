"use server";

import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { CategorySchema, FeedSchema } from "@/lib/repository/feedSchema";
import { getUserId } from "@/lib/repository/userRepository";
import { scrapeArticle, scrapeFeed } from "@/lib/scraper";
import { Article, Feed } from "@prisma/client";
import { parseFeed } from "htmlparser2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const createFeed = async (feed: FeedSchema) => {
  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);

  if (!parsedFeed || !parsedFeed.title) {
    throw new Error("Invalid feed");
  }

  const userId = await getUserId();

  const createdFeed = await prisma.feed.create({
    data: {
      ...feed,
      title: feed.title || parsedFeed.title,
      lastFetched: new Date(0),
      userId: userId,
    },
  });

  revalidatePath("/feed", "layout");

  await refreshFeed(createdFeed.id);
};

export const deleteFeed = async (feedId: number) => {
  const userId = await getUserId();

  await prisma.article.deleteMany({ where: { feedId: feedId, userId } });
  await prisma.feed.delete({ where: { id: feedId, userId } });

  revalidatePath("/feed", "layout");
  redirect("/");
};

const processArticle = async (article: Article) => {
  try {
    await scrapeArticle(article.id, article.link);
  } catch (error) {
    logger.error(
      { article: { id: article.id, title: article.title, link: article.link } },
      "Failed to scrape article.",
    );
  }

  revalidatePath(`/feed/${article.feedId}`);
};

export const refreshFeed = async (feedId: number) => {
  const userId = await getUserId();

  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId, userId },
  });

  logger.debug({ feedId, feedTitle: feed.title }, "Refreshing feed.");

  const feedItems = await scrapeFeed(feed);

  const titleFilterExpressions = feed.titleFilterExpressions
    .split("\n")
    .filter((regex) => regex !== "");
  const filteredFeedItems = feedItems.filter((item) => {
    let regex: RegExp;
    return !titleFilterExpressions.some((regexString) => {
      try {
        regex = new RegExp(regexString);
      } catch (error) {
        logger.warn(
          {
            article: {
              title: item.title,
              link: item.link,
              publicationDate: item.publicationDate,
            },
            titleFilterExpression: regexString,
          },
          "Invalid title filter expression.",
        );
        return false; // ignore invalid regex
      }
      const test = regex.test(item.title);

      if (test) {
        logger.debug(
          {
            article: {
              title: item.title,
              link: item.link,
              publicationDate: item.publicationDate,
            },
            matchedTitleFilterExpression: regexString,
          },
          "Filtered out article because of title filter.",
        );
      }

      return test;
    });
  });

  const createArticlePromises = filteredFeedItems.map((item) =>
    prisma.article.create({
      data: {
        ...item,
        feedId: feed.id,
        userId: feed.userId,
      },
    }),
  );

  const createArticleResults = await Promise.allSettled(createArticlePromises);
  // TODO check whether articles that already exist have changed
  const createdArticles = createArticleResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  const processedArticles = createdArticles.map((article) =>
    processArticle(article),
  );
  await Promise.allSettled(processedArticles);

  await updateLastFetchedToNow(feed);

  revalidatePath(`/feed/${feedId}`);

  logger.info(
    {
      feed: { id: feed.id, title: feed.title, link: feed.link },
      numberOfNewArticles: createdArticles.length,
    },
    "Feed refreshed. Processing new articles in the background.",
  );
};

export const refreshCategoryFeeds = async (categoryId: number) => {
  const userId = await getUserId();

  const feeds = await prisma.feed.findMany({
    where: { feedCategoryId: categoryId, userId },
    select: { id: true },
  });

  const promises = feeds.map(async (feed) => {
    await refreshFeed(feed.id);
    revalidatePath(`/feed/${feed.id}`);
  });
  const results = await Promise.allSettled(promises);

  revalidatePath("/feed");
  revalidatePath(`/feed/category/${categoryId}`);

  if (results.filter((result) => result.status === "rejected").length > 0) {
    throw new Error("Failed to refresh one or more feeds.");
  }
};

export const refreshFeeds = async () => {
  logger.debug("Refreshing all feeds.");

  const userId = await getUserId();

  const feeds = await prisma.feed.findMany({
    select: { id: true },
    where: { userId },
  });

  const promises = feeds.map(async (feed) => {
    await refreshFeed(feed.id);
    revalidatePath(`/feed/${feed.id}`);
  });
  const results = await Promise.allSettled(promises);

  revalidatePath("/feed");

  if (results.filter((result) => result.status === "rejected").length > 0) {
    throw new Error("Failed to refresh one or more feeds.");
  }
};

export const updateFeed = async (feedId: number, feed: FeedSchema) => {
  const userId = await getUserId();

  await prisma.feed.update({
    where: { id: feedId, userId },
    data: {
      ...feed,
    },
  });

  revalidatePath("/feed", "layout");

  await refreshFeed(feedId);
};

const updateLastFetchedToNow = async (feed: Feed) => {
  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });
};

export const getUserCategories = async () => {
  const userId = await getUserId();

  return prisma.feedCategory.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
};

export const createCategory = async (category: CategorySchema) => {
  const userId = await getUserId();

  await prisma.feedCategory.create({
    data: {
      ...category,
      userId: userId,
    },
  });

  revalidatePath("/feed", "layout");
};

export const updateCategory = async (
  categoryId: number,
  category: CategorySchema,
) => {
  await prisma.feedCategory.update({
    where: { id: categoryId },
    data: {
      ...category,
    },
  });

  revalidatePath("/feed", "layout");
};

export const deleteCategory = async (categoryId: number) => {
  // First, update all feeds in this category to have no category
  await prisma.feed.updateMany({
    where: { feedCategoryId: categoryId },
    data: { feedCategoryId: null },
  });

  // Then delete the category
  await prisma.feedCategory.delete({
    where: { id: categoryId },
  });

  revalidatePath("/feed", "layout");
};
