"use server";

import { Article, Feed } from "@/generated/prisma/client";
import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
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
// htmlparser2 exposes neither <comments> nor per-item authors, so both are read
// straight off the feed source. The blocks are matched with a regex rather than
// a second DOM pass because only a handful of elements are needed.
const FEED_ITEM_PATTERN = /<(item|entry)(?:\s[^>]*)?>.*?<\/\1>/gs;

// Reduces an element's raw inner XML to the plain text it stands for: entities
// decoded, any markup around the value dropped. Parsing rather than unescaping
// by hand keeps this identical to how htmlparser2 decoded the feed's own
// fields, which matters because item links are used as lookup keys below.
const decodeFeedText = (value: string) =>
  DomUtils.textContent(
    // As far as XML is concerned CDATA is literal text, but publishers use it
    // to embed markup — typically a link wrapped around the author's name — so
    // the section is unwrapped and its content parsed like everything else.
    parseDocument(value.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1"), {
      xmlMode: true,
    }),
  )
    .replace(/\s+/g, " ")
    .trim();

const extractElement = (block: string, tagName: string) => {
  const match = block.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>(.*?)</${tagName}>`, "s"),
  );
  return match ? decodeFeedText(match[1]) : null;
};

const extractItemLink = (block: string) => {
  const rssLink = extractElement(block, "link");
  if (rssLink) return rssLink;

  // Atom puts the target in the href attribute of a self-closing <link>.
  // htmlparser2 takes the first one regardless of its rel, so do the same.
  const atomLink = block.match(/<link(?:\s[^>]*)?\shref="(.*?)"/s);
  return atomLink ? decodeFeedText(atomLink[1]) : null;
};

const extractAuthor = (block: string) => {
  // dc:creator carries a display name, whereas RSS 2.0 specifies <author> as an
  // email address, so a creator is the better label whenever both are present.
  const creators = [
    ...block.matchAll(/<dc:creator(?:\s[^>]*)?>(.*?)<\/dc:creator>/gs),
  ]
    .map((match) => decodeFeedText(match[1]))
    .filter((name) => name !== "");
  if (creators.length > 0) return creators.join(", ");

  const authors = [...block.matchAll(/<author(?:\s[^>]*)?>(.*?)<\/author>/gs)]
    .map((match) => {
      // Atom wraps the display name in <name>. RSS publishers that follow the
      // email convention usually append the name: "jane@example.com (Jane Doe)".
      const name = extractElement(match[1], "name");
      if (name) return name;

      const text = decodeFeedText(match[1]);
      const parenthesised = text.match(/\(([^)]*)\)/);
      return parenthesised ? parenthesised[1].trim() : text;
    })
    .filter((name) => name !== "");

  return authors.length > 0 ? authors.join(", ") : null;
};

const extractItemMetadata = (feedSource: string) => {
  const itemBlocks = [...feedSource.matchAll(FEED_ITEM_PATTERN)].map(
    (match) => match[0],
  );

  // An Atom entry inherits the feed-level author when it declares none of its
  // own (RFC 4287 §4.2.1), which is how single-author blogs usually publish.
  const feedAuthor = extractAuthor(feedSource.replace(FEED_ITEM_PATTERN, ""));

  const metadataByItemLink = new Map<
    string,
    { commentsLink: string | null; author: string | null }
  >();
  for (const block of itemBlocks) {
    const link = extractItemLink(block);
    if (!link) continue;

    metadataByItemLink.set(link, {
      commentsLink: extractElement(block, "comments"),
      author: extractAuthor(block) ?? feedAuthor,
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
      const metadata = metadataByItemLink.get(item.link);
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
