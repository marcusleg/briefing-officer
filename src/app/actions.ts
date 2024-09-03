"use server";

import { generateAiLead } from "@/app/feed/[feedId]/[articleId]/ai-summary/actions";
import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
import logger from "@/lib/logger";
import { parseFeed } from "htmlparser2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "../lib/prismaClient";

export const addFeed = async (url: string) => {
  const feed = await fetch(url).then((res) => res.text());
  const parsedFeed = parseFeed(feed);

  if (!parsedFeed || !parsedFeed.title) {
    throw new Error("Invalid feed");
  }

  await prisma.feed.create({
    data: {
      title: parsedFeed.title,
      link: url,
      lastFetched: new Date(),
    },
  });

  revalidatePath("/", "layout");
};

export const deleteFeed = async (feedId: number) => {
  await prisma.article.deleteMany({ where: { feedId: feedId } });
  await prisma.feed.delete({ where: { id: feedId } });

  revalidatePath("/", "layout");
  redirect("/");
};

export const markArticlesOlderThanXDaysAsRead = async (
  feedId: number,
  days: number,
) => {
  const date = new Date();
  date.setDate(date.getDate() - days);

  await prisma.article.updateMany({
    where: { feedId: feedId, publicationDate: { lte: date } },
    data: { read: true },
  });

  revalidatePath(`/feed/${feedId}`);
  revalidatePath("/");
};

export const refreshFeed = async (feedId: number) => {
  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });

  logger.info({ feedId, feedTitle: feed.title }, "Refreshing feed.");

  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);
  if (!parsedFeed) {
    throw new Error("Unable to parse feed.");
  }

  const promises = parsedFeed.items.map((item) => {
    if (!item.title || !item.link || !item.pubDate) {
      logger.error(
        { feedId: item.id, feedTitle: item.title },
        "Invalid feed item.",
      );
      return;
    }

    return prisma.article.upsert({
      where: { link: item.link },
      update: {
        title: item.title,
        description: item.description,
        publicationDate: new Date(item.pubDate),
      },
      create: {
        title: item.title,
        description: item.description,
        link: item.link,
        publicationDate: new Date(item.pubDate),
        feedId: feed.id,
      },
    });
  });
  const newArticlePromises = await Promise.all(promises);
  const definedNewArticlesPromises = newArticlePromises.filter(
    (article) => article !== undefined,
  );

  const newArticleReadabilityPromises = definedNewArticlesPromises.map(
    (article) => getReadability(article.id, article.link),
  );
  await Promise.all(newArticleReadabilityPromises);

  // generate AI leads sequentially to avoid rate limiting
  for (const article of definedNewArticlesPromises) {
    await generateAiLead(article.id);
  }

  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });

  revalidatePath(`/feed/${feedId}`);

  logger.info({ feedId, feedTitle: feed.title }, "Feed refreshed.");
};

export const refreshFeeds = async () => {
  logger.info("Refreshing all feeds.");

  const feeds = await prisma.feed.findMany({ select: { id: true } });
  const promises = feeds.map((feed) => refreshFeed(feed.id));
  await Promise.all(promises);

  revalidatePath("/");
  feeds.forEach((feed) => revalidatePath(`/feed/${feed.id}`));
};

export const editFeed = async (
  feedId: number,
  newTitle: string,
  newFeedUrl: string,
) => {
  await prisma.feed.update({
    where: { id: feedId },
    data: {
      title: newTitle,
      link: newFeedUrl,
    },
  });

  revalidatePath("/", "layout");
};
