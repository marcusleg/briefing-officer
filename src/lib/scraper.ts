import { Article, Feed } from "@/generated/prisma/client";
import { ARTICLE_RETENTION_DAYS } from "@/lib/constants";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
import type { AnyNode } from "domhandler";
import { DomUtils, parseDocument, parseFeed } from "htmlparser2";
import { JSDOM } from "jsdom";
import type { Readable } from "node:stream";
import { extractText, getDocumentProxy, getMeta } from "unpdf";

// HTML parsing is synchronous and blocks the event loop for as long as it
// runs, so only pages that can be articles are parsed at all. The size limit
// bounds the cost of those: the largest real articles are around 2 MB and parse
// in about a second.
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
// pdf.js slices its work into short tasks, so a PDF costs memory rather than
// event-loop time: a 100-page paper blocked for at most about 100 ms but
// peaked at about 200 MiB. Papers with figures often run past 5 MB.
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

const http = axios.create({
  timeout: 10000,
  responseType: "stream",
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

type ParsedArticle = {
  textContent: string | null | undefined;
  byline: string | null | undefined;
} | null;

// JSDOM does not run scripts or load subresources unless told to, and only
// Readability's plain text is kept, so the page needs no sanitizing first.
// Decoded as UTF-8 regardless of the declared charset, as before PDF support.
const parseHtml = (body: Uint8Array): ParsedArticle => {
  const document = new JSDOM(new TextDecoder().decode(body));
  return new Readability(document.window.document).parse();
};

// pdf.js otherwise logs recoverable problems in a document straight to the
// console, outside the app's logger.
const VERBOSITY_ERRORS = 0;

// A scanned PDF has no text layer and yields only the line breaks between its
// pages, which the trim turns into the empty content that fails the scrape.
const parsePdf = async (body: Uint8Array): Promise<ParsedArticle> => {
  const pdf = await getDocumentProxy(body, {
    verbosity: VERBOSITY_ERRORS,
  });
  try {
    const { text } = await extractText(pdf, { mergePages: true });
    const { info } = await getMeta(pdf);
    const author = typeof info.Author === "string" ? info.Author.trim() : "";
    return { textContent: text.trim(), byline: author || null };
  } finally {
    await pdf.loadingTask.destroy();
  }
};

// Read as markup, a PDF or other binary builds an enormous, deeply nested DOM;
// one 4 MB PDF took over a minute and stalled the whole server. So each
// response goes to the parser for its media type, and any other type is
// refused before its body is read.
const parsers = new Map<
  string,
  {
    maxBytes: number;
    parse: (body: Uint8Array) => Promise<ParsedArticle> | ParsedArticle;
  }
>([
  ["text/html", { maxBytes: MAX_HTML_BYTES, parse: parseHtml }],
  ["application/xhtml+xml", { maxBytes: MAX_HTML_BYTES, parse: parseHtml }],
  ["application/pdf", { maxBytes: MAX_PDF_BYTES, parse: parsePdf }],
]);

// The limit is checked as the body streams in, so an oversized response is
// dropped once it passes the limit instead of being downloaded in full. The
// body is copied into memory of its own rather than joined with Buffer.concat,
// whose result can share Node's buffer pool: pdf.js may take ownership of the
// bytes it is given.
const readBody = async (stream: Readable, maxBytes: number) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new Error(`Response is larger than ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
};

// With a streamed response, axios rejects an error status without reading its
// body, which would hold the connection open until the request times out.
const get = async (url: string) => {
  try {
    return await http.get<Readable>(url);
  } catch (error) {
    if (axios.isAxiosError<Readable>(error)) {
      error.response?.data?.destroy();
    }
    throw error;
  }
};

const fetchAndParseArticle = async (articleLink: string) => {
  const response = await get(articleLink);
  const mediaType = String(response.headers["content-type"] ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const parser = parsers.get(mediaType);
  if (!parser) {
    response.data.destroy();
    throw new Error(`Unsupported content type: ${mediaType || "none"}`);
  }

  return parser.parse(await readBody(response.data, parser.maxBytes));
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
