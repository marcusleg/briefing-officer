"use server";

import { generateAiLead } from "@/app/feed/[feedId]/[articleId]/ai-summary/actions";
import { scrapeArticle } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";
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

  const createdFeed = await prisma.feed.create({
    data: {
      title: parsedFeed.title,
      link: url,
      lastFetched: new Date(),
    },
  });

  revalidatePath("/", "layout");

  void refreshFeed(createdFeed.id);
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
    data: { readAt: new Date() },
  });

  revalidatePath(`/feed/${feedId}`);
  revalidatePath("/");
};

export const refreshFeed = async (feedId: number) => {
  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });

  logger.debug({ feedId, feedTitle: feed.title }, "Refreshing feed.");

  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);
  if (!parsedFeed) {
    logger.error(
      { feed: { id: feed.id, title: feed.title, link: feed.link } },
      "Unable to parse feed.",
    );

    throw new Error("Unable to parse feed.");
  }

  const promises = parsedFeed.items.slice(0, 100).map((item) => {
    if (!item.title || !item.link || !item.pubDate) {
      logger.error(
        { feed: { id: feed.id, title: feed.title, link: feed.link } },
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

  const newArticleScrapesPromises = definedNewArticlesPromises.map((article) =>
    scrapeArticle(article.id, article.link),
  );
  await Promise.allSettled(newArticleScrapesPromises); // TODO handle errors, emit log message

  const generateAiLeadsPromises = definedNewArticlesPromises.map((article) =>
    generateAiLead(article.id),
  );
  await Promise.all(generateAiLeadsPromises);

  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });

  revalidatePath(`/feed/${feedId}`);

  logger.info(
    { feed: { id: feed.id, title: feed.title, link: feed.link } },
    "Feed refreshed.",
  );
};

export const refreshFeeds = async () => {
  logger.debug("Refreshing all feeds.");

  const feeds = await prisma.feed.findMany({ select: { id: true } });

  const promises = feeds.map(async (feed) => {
    await refreshFeed(feed.id);
    revalidatePath(`/feed/${feed.id}`);
  });
  const results = await Promise.allSettled(promises);

  revalidatePath("/");

  if (results.filter((result) => result.status === "rejected").length > 0) {
    throw new Error("Failed to refresh one or more feeds.");
  }
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
