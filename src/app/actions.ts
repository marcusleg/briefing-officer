"use server";
import prisma from "../lib/prismaClient";
import { parseFeed } from "htmlparser2";

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
};

export const getFeeds = async () => {
  return prisma.feed.findMany({ orderBy: { title: "asc" } });
};

export const refreshFeeds = async () => {
  const feeds = await prisma.feed.findMany({});
  const promises = feeds.map((feed) =>
    fetch(feed.link).then((res) => res.text()),
  );
  const results = await Promise.all(promises);
  return results.map((result) => parseFeed(result));
};
