"use server";

import { generateAiLead } from "@/lib/ai";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { FeedSchema } from "@/lib/repository/feedSchema";
import { scrapeArticle, scrapeFeed } from "@/lib/scraper";
import { Article } from "@prisma/client";
import { parseFeed } from "htmlparser2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const createFeed = async (feed: FeedSchema) => {
  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);

  if (!parsedFeed || !parsedFeed.title) {
    throw new Error("Invalid feed");
  }

  const createdFeed = await prisma.feed.create({
    data: {
      ...feed,
      title: feed.title || parsedFeed.title,
      lastFetched: new Date(0),
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

const processArticle = async (article: Article) => {
  try {
    await scrapeArticle(article.id, article.link);
  } catch (error) {
    logger.error(
      { article: { id: article.id, title: article.title, link: article.link } },
      "Failed to scrape article.",
    );
  }

  try {
    await generateAiLead(article.id);
  } catch (error) {
    logger.error(
      { article: { id: article.id, title: article.title, link: article.link } },
      "Failed to generate AI lead.",
    );
  }

  revalidatePath(`/feed/${article.feedId}`);
  revalidatePath(`/feed/${article.feedId}/${article.id}`);
  revalidatePath(`/feed/${article.feedId}/${article.id}/reader-view`);
};

export const refreshFeed = async (feedId: number) => {
  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
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
      },
    }),
  );

  const createArticleResults = await Promise.allSettled(createArticlePromises);
  // TODO check whether articles that already exist have changed
  const createdArticles = createArticleResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  // process articles asynchronously
  createdArticles.map((article) => processArticle(article));

  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });

  revalidatePath(`/feed/${feedId}`);

  logger.info(
    {
      feed: { id: feed.id, title: feed.title, link: feed.link },
      numberOfNewArticles: createdArticles.length,
    },
    "Feed refreshed. Processing new articles in the background.",
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

export const updateFeed = async (feedId: number, feed: FeedSchema) => {
  await prisma.feed.update({
    where: { id: feedId },
    data: {
      ...feed,
    },
  });

  revalidatePath("/", "layout");

  void refreshFeed(feedId);
};
