"use server";

import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
import { parseFeed } from "htmlparser2";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";
import { Article, Feed } from "../../prisma/generated/prisma/client";

const http = axios.create({
  timeout: 10000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    Connection: "keep-alive",
  },
});

const fetchAndParseArticle = async (articleLink: string) => {
  const website = await http.get(articleLink);
  const cleanBody = DOMPurify.sanitize(website.data);
  const document = new JSDOM(cleanBody);
  return new Readability(document.window.document).parse();
};

export const scrapeArticle = async (articleId: number, articleLink: string) => {
  const parsedArticle = await fetchAndParseArticle(articleLink);

  if (!parsedArticle) {
    throw new Error("Failed to parse article. Article is null.");
  }

  if (!parsedArticle.textContent) {
    throw new Error(`Failed to parse article content. Content is empty."`);
  }

  const articleData = {
    textContent: parsedArticle!.textContent,
    author: parsedArticle!.byline ?? "",
  };

  const scrape = prisma.articleScrape.upsert({
    where: { articleId: articleId },
    create: {
      article: {
        connect: { id: articleId },
      },
      ...articleData,
    },
    update: {
      ...articleData,
      author: parsedArticle!.byline ?? undefined,
    },
  });

  logger.info(
    {
      article: { id: articleId, link: articleLink },
    },
    "Scraped article.",
  );

  return scrape;
};
export const scrapeFeed = async (feed: Feed) => {
  const fetchedFeed = await fetch(feed.link).then((res) => res.text());
  const parsedFeed = parseFeed(fetchedFeed);
  if (!parsedFeed) {
    logger.error(
      { feed: { id: feed.id, title: feed.title, link: feed.link } },
      "Unable to parse feed.",
    );

    throw new Error("Unable to parse feed.");
  }

  const validFeedItems: Pick<
    Article,
    "title" | "link" | "description" | "publicationDate"
  >[] = [];
  parsedFeed.items.forEach((item) => {
    if (!item.title || !item.link || !item.pubDate) {
      logger.error({ item }, "Invalid feed item.");
    } else {
      validFeedItems.push({
        title: item.title,
        link: item.link,
        description: item.description ? item.description : null,
        publicationDate: new Date(item.pubDate),
      });
    }
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ARTICLE_RETENTION_DAYS);

  return validFeedItems.filter((item) => item.publicationDate >= thirtyDaysAgo);
};
