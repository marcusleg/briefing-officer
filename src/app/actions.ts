"use server";
import prisma from "../lib/prismaClient";
import { parseFeed } from "htmlparser2";
import { revalidatePath } from "next/cache";

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

export const refreshFeed = async (feedId: number) => {
  const feed = await prisma.feed.findUniqueOrThrow({
    where: { id: feedId },
  });
  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);
  if (!parsedFeed) {
    throw new Error("Unable to parse feed.");
  }

  const promises = parsedFeed.items.map((item) =>
    prisma.article.upsert({
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
    }),
  );
  await Promise.all(promises);

  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });

  revalidatePath(`/feed/${feedId}`);
};
