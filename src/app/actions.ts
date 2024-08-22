"use server";

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

  const promises = parsedFeed.items.map((item) => {
    if (!item.title || !item.link || !item.pubDate) {
      console.log("Invalid feed item", item);
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
  await Promise.all(promises);

  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      lastFetched: new Date(),
    },
  });

  revalidatePath(`/feed/${feedId}`);
};

export const refreshFeeds = async () => {
  const feeds = await prisma.feed.findMany({ select: { id: true } });
  const promises = feeds.map((feed) => refreshFeed(feed.id));
  await Promise.all(promises);
};

export const renameFeed = async (feedId: number, newTitle: string) => {
  await prisma.feed.update({
    where: { id: feedId },
    data: {
      title: newTitle,
    },
  });

  revalidatePath("/", "layout");
};
