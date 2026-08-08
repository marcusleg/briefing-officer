"use server";

import { Article, Feed } from "@/generated/prisma/client";
import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
import type { AnyNode } from "domhandler";
import { DomUtils, parseDocument, parseFeed } from "htmlparser2";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";

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
    textContent: parsedArticle.textContent,
    author: parsedArticle.byline ?? "",
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
      // Overrides the "" above: a re-scrape that finds no byline should leave
      // whatever was stored, not blank it.
      author: parsedArticle.byline ?? undefined,
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
// htmlparser2's feed parser exposes neither <comments> nor per-item authors,
// so the source is parsed a second time and read element by element.

// Item links are used as lookup keys against the parsed feed, which trims
// element text but reads link attributes raw. Both sides go through this so a
// link carrying stray whitespace still finds its match.
const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

// Reduces an element to the plain text it stands for. textContent() decodes
// entities but returns CDATA verbatim, and publishers use CDATA to embed
// markup — typically a link wrapped around the author's name — so a value that
// still looks like markup is parsed once more.
const elementText = (element: AnyNode): string => {
  const text = collapseWhitespace(DomUtils.textContent(element));
  if (!text.includes("<")) return text;

  return collapseWhitespace(
    DomUtils.textContent(parseDocument(text, { xmlMode: true })),
  );
};

// Direct children only, which is how htmlparser2 reads the same elements. An
// <author> belonging to something nested inside the item is not its byline.
const childElements = (children: AnyNode[], tagName: string) =>
  DomUtils.getElementsByTagName(tagName, children, false);

const firstChildText = (children: AnyNode[], tagName: string) => {
  const [element] = childElements(children, tagName);
  return element ? elementText(element) || null : null;
};

const extractAuthor = (children: AnyNode[]) => {
  // dc:creator carries a display name, whereas RSS 2.0 specifies <author> as an
  // email address, so a creator is the better label whenever both are present.
  const creators = childElements(children, "dc:creator")
    .map(elementText)
    .filter((name) => name !== "");
  if (creators.length > 0) return creators.join(", ");

  const authors = childElements(children, "author")
    .map((element) => {
      // Atom wraps the display name in <name>. RSS publishers that follow the
      // email convention usually append the name: "jane@example.com (Jane Doe)".
      const name = firstChildText(element.children, "name");
      if (name) return name;

      const text = elementText(element);
      return text.match(/\(([^)]*)\)/)?.[1].trim() ?? text;
    })
    .filter((name) => name !== "");

  return authors.length > 0 ? authors.join(", ") : null;
};

const extractItemMetadata = (feedSource: string) => {
  const document = parseDocument(feedSource, { xmlMode: true });

  const items = DomUtils.getElementsByTagName(
    (name) => name === "item" || name === "entry",
    document,
    true,
  );

  // An Atom entry inherits the feed-level author when it declares none of its
  // own (RFC 4287 §4.2.1), which is how single-author blogs usually publish.
  // Read from the channel's own children, so an item's author is not mistaken
  // for the feed's.
  const [feedRoot] = DomUtils.getElementsByTagName(
    (name) => name === "channel" || name === "feed",
    document,
    true,
    1,
  );
  const feedAuthor = feedRoot ? extractAuthor(feedRoot.children) : null;

  const metadataByItemLink = new Map<
    string,
    { commentsLink: string | null; author: string | null }
  >();
  for (const item of items) {
    // Atom puts the target in the href attribute of a self-closing <link>.
    // htmlparser2 takes the first one regardless of its rel, so do the same.
    const link =
      firstChildText(item.children, "link") ??
      childElements(item.children, "link")[0]?.attribs.href;
    if (!link) continue;

    metadataByItemLink.set(collapseWhitespace(link), {
      commentsLink: firstChildText(item.children, "comments"),
      author: extractAuthor(item.children) ?? feedAuthor,
    });
  }

  return metadataByItemLink;
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

  const metadataByItemLink = extractItemMetadata(fetchedFeed);

  const validFeedItems: Pick<
    Article,
    | "title"
    | "link"
    | "description"
    | "publicationDate"
    | "commentsLink"
    | "author"
  >[] = [];
  parsedFeed.items.forEach((item) => {
    if (!item.title || !item.link || !item.pubDate) {
      logger.error({ item }, "Invalid feed item.");
    } else {
      const metadata = metadataByItemLink.get(collapseWhitespace(item.link));
      validFeedItems.push({
        title: item.title,
        link: item.link,
        description: item.description ? item.description : null,
        publicationDate: new Date(item.pubDate),
        commentsLink: metadata?.commentsLink ?? null,
        author: metadata?.author ?? null,
      });
    }
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ARTICLE_RETENTION_DAYS);

  return validFeedItems.filter((item) => item.publicationDate >= thirtyDaysAgo);
};
