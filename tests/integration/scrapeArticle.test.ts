import prisma from "@/lib/prismaClient";
import { MAX_HTML_BYTES, MAX_PDF_BYTES, scrapeArticle } from "@/lib/scraper";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";
import { buildPdf } from "../helpers/pdf";

const paragraph =
  "The quick brown fox jumps over the lazy dog while the reporter takes notes. ";
const articleHtml = `<!doctype html>
<html><head><title>Story</title><meta name="author" content="Jane Doe"></head>
<body><article><h1>Story</h1><p>${paragraph.repeat(20)}</p><p>${paragraph.repeat(20)}</p></article></body></html>`;

const routes: Record<string, { type?: string; body: () => string }> = {
  "/article": { type: "text/html; charset=utf-8", body: () => articleHtml },
  "/xhtml": { type: "application/xhtml+xml", body: () => articleHtml },
  "/paper.pdf": {
    type: "application/pdf",
    body: () =>
      buildPdf({
        pages: ["Abstract: foxes jump.", "Conclusion: dogs stay lazy."],
        author: "Ada Lovelace",
      }),
  },
  "/anonymous.pdf": {
    type: "application/pdf",
    body: () => buildPdf({ pages: ["An anonymous pamphlet."] }),
  },
  "/scan.pdf": {
    type: "application/pdf",
    body: () => buildPdf({ pages: [null, null] }),
  },
  "/encrypted.pdf": {
    type: "application/pdf",
    body: () => buildPdf({ pages: ["Top secret."], encrypted: true }),
  },
  "/broken.pdf": {
    type: "application/pdf",
    body: () => "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj << /Type /Catalog >>",
  },
  "/oversized.pdf": {
    type: "application/pdf",
    body: () => buildPdf({ pages: ["Huge."] }) + "%".repeat(MAX_PDF_BYTES),
  },
  "/image": { type: "image/png", body: () => "\x89PNG\r\n\x1a\n" },
  "/untyped": { body: () => articleHtml },
  "/oversized": {
    type: "text/html",
    body: () => articleHtml + " ".repeat(MAX_HTML_BYTES),
  },
};

let server: Server;
let baseUrl: string;
// Resolves once the server sees the client drop the stalled error response.
let stalledErrorClosed: Promise<void>;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/stalled-error") {
      stalledErrorClosed = new Promise((resolve) =>
        response.on("close", resolve),
      );
      response.writeHead(403, { "Content-Type": "text/html" });
      response.write("<p>Access denied");
      return;
    }
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

  it("stores the full text and metadata author of a PDF", async () => {
    await scrapeArticle(articleId, `${baseUrl}/paper.pdf`);

    const scrape = await storedScrape();
    expect(scrape?.textContent).toContain("Abstract: foxes jump.");
    expect(scrape?.textContent).toContain("Conclusion: dogs stay lazy.");
    expect(scrape?.author).toBe("Ada Lovelace");
  });

  it("stores a PDF without an author in its metadata", async () => {
    await scrapeArticle(articleId, `${baseUrl}/anonymous.pdf`);

    const scrape = await storedScrape();
    expect(scrape?.textContent).toContain("An anonymous pamphlet.");
    expect(scrape?.author).toBe("");
  });

  it("fails on a PDF with no text layer", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/scan.pdf`),
    ).rejects.toThrow("Content is empty");
    expect(await storedScrape()).toBeNull();
  });

  it("fails on an encrypted PDF", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/encrypted.pdf`),
    ).rejects.toThrow("No password given");
    expect(await storedScrape()).toBeNull();
  });

  it("fails on a broken PDF", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/broken.pdf`),
    ).rejects.toThrow("Invalid PDF structure");
    expect(await storedScrape()).toBeNull();
  });

  it("refuses a PDF larger than the PDF size limit", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/oversized.pdf`),
    ).rejects.toThrow(`Response is larger than ${MAX_PDF_BYTES} bytes`);
    expect(await storedScrape()).toBeNull();
  });

  it("refuses other content types", async () => {
    await expect(scrapeArticle(articleId, `${baseUrl}/image`)).rejects.toThrow(
      "Unsupported content type: image/png",
    );
    expect(await storedScrape()).toBeNull();
  });

  it("drops the connection of an error response without waiting for its body", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/stalled-error`),
    ).rejects.toThrow("status code 403");

    const outcome = await Promise.race([
      stalledErrorClosed.then(() => "closed"),
      new Promise((resolve) => setTimeout(resolve, 1000, "still open")),
    ]);
    expect(outcome).toBe("closed");
  });

  it("refuses a response that declares no content type", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/untyped`),
    ).rejects.toThrow("Unsupported content type: none");
    expect(await storedScrape()).toBeNull();
  });

  it("refuses a page larger than the HTML size limit", async () => {
    await expect(
      scrapeArticle(articleId, `${baseUrl}/oversized`),
    ).rejects.toThrow(`Response is larger than ${MAX_HTML_BYTES} bytes`);
    expect(await storedScrape()).toBeNull();
  });
});
