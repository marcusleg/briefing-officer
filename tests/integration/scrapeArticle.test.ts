import prisma from "@/lib/prismaClient";
import { MAX_ARTICLE_BYTES, scrapeArticle } from "@/lib/scraper";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

const paragraph =
  "The quick brown fox jumps over the lazy dog while the reporter takes notes. ";
const articleHtml = `<!doctype html>
<html><head><title>Story</title><meta name="author" content="Jane Doe"></head>
<body><article><h1>Story</h1><p>${paragraph.repeat(20)}</p><p>${paragraph.repeat(20)}</p></article></body></html>`;

const routes: Record<string, { type?: string; body: () => string }> = {
  "/article": { type: "text/html; charset=utf-8", body: () => articleHtml },
  "/xhtml": { type: "application/xhtml+xml", body: () => articleHtml },
  "/pdf": {
    type: "application/pdf",
    body: () => "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj << /Type /Catalog >>",
  },
  "/untyped": { body: () => articleHtml },
  "/oversized": {
    type: "text/html",
    body: () => articleHtml + " ".repeat(MAX_ARTICLE_BYTES),
  },
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const route = routes[request.url ?? ""];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    if (route.type) {
      response.setHeader("Content-Type", route.type);
    }
    response.end(route.body());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

let articleId: number;

beforeEach(async () => {
  const userId = (await createUser()).id;
  const feedId = (await createFeed({ userId })).id;
  articleId = (await createArticle({ userId, feedId })).id;
});

const storedScrape = () =>
  prisma.articleScrape.findUnique({ where: { articleId } });

describe("scrapeArticle", () => {
  it("stores the readable text of an HTML page", async () => {
    await scrapeArticle(articleId, `${baseUrl}/article`);

    const scrape = await storedScrape();
    expect(scrape?.textContent).toContain("The quick brown fox");
    expect(scrape?.author).toBe("Jane Doe");
  });

  it("accepts XHTML", async () => {
    await scrapeArticle(articleId, `${baseUrl}/xhtml`);

    expect((await storedScrape())?.textContent).toContain("quick brown fox");
  });

  it("refuses a PDF without parsing it", async () => {
    await expect(scrapeArticle(articleId, `${baseUrl}/pdf`)).rejects.toThrow(
      "Not an HTML page: application/pdf",
    );
    expect(await storedScrape()).toBeNull();
  });

  it("refuses a response that declares no content type", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/untyped`),
    ).rejects.toThrow("Not an HTML page");
    expect(await storedScrape()).toBeNull();
  });

  it("refuses a page larger than the size limit", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/oversized`),
    ).rejects.toThrow(/maxContentLength/);
    expect(await storedScrape()).toBeNull();
  });
});
