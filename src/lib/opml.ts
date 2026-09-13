import type { AnyNode, Element } from "domhandler";
import { DomUtils, parseDocument } from "htmlparser2";

/**
 * Thrown by parseOpml when the text has no <opml> root with a <body>. The
 * message is reader-facing: the import dialog shows it verbatim.
 */
export class InvalidOpmlError extends Error {
  constructor() {
    super("This file is not an OPML document.");
    this.name = "InvalidOpmlError";
  }
}

export interface OpmlFeedEntry {
  title: string;
  xmlUrl: string;
  /** The innermost enclosing folder, or null for a feed at body level. */
  category: string | null;
}

export interface ParsedOpml {
  entries: OpmlFeedEntry[];
}

export interface OpmlExportFeed {
  title: string;
  xmlUrl: string;
}

export interface OpmlExportCategory {
  /** null groups the uncategorised feeds, which are emitted at body level. */
  name: string | null;
  feeds: OpmlExportFeed[];
}

/**
 * Returned rather than thrown for expected failures because Next.js masks the
 * message of an error thrown by a server action in production, and the dialog
 * needs the message.
 */
export type OpmlImportResult =
  | {
      ok: true;
      imported: number;
      /** Already subscribed before this import. */
      skipped: number;
      categoriesCreated: number;
      /** Titles of entries whose xmlUrl was not an absolute http(s) URL. */
      unusable: string[];
    }
  | { ok: false; error: string };

// Attribute names are matched case-insensitively: the spec writes xmlUrl, and
// some exporters write xmlurl.
const attribute = (element: Element, name: string): string | undefined => {
  const wanted = name.toLowerCase();
  const key = Object.keys(element.attribs).find(
    (candidate) => candidate.toLowerCase() === wanted,
  );
  return key === undefined ? undefined : element.attribs[key].trim();
};

const isOutline = (node: AnyNode): node is Element =>
  DomUtils.isTag(node) && node.name.toLowerCase() === "outline";

const hasTagName = (name: string) => (candidate: string) =>
  candidate.toLowerCase() === name;

// Walks up from a feed outline to the first enclosing outline that is not a
// feed itself. Nesting deeper than one level is flattened to the innermost
// folder: the application has one level of categories, and the innermost
// name is the most specific.
const enclosingFolder = (element: Element): string | null => {
  let parent = element.parent;
  while (parent && isOutline(parent)) {
    if (!attribute(parent, "xmlUrl")) {
      return attribute(parent, "text") || attribute(parent, "title") || null;
    }
    parent = parent.parent;
  }
  return null;
};

export const parseOpml = (text: string): ParsedOpml => {
  const document = parseDocument(text, { xmlMode: true });

  const [root] = DomUtils.getElementsByTagName(
    hasTagName("opml"),
    document.children,
    false,
    1,
  );
  const [body] = root
    ? DomUtils.getElementsByTagName(hasTagName("body"), root.children, false, 1)
    : [];

  if (!body) {
    throw new InvalidOpmlError();
  }

  const entries = DomUtils.findAll(isOutline, body.children).flatMap(
    (outline) => {
      const xmlUrl = attribute(outline, "xmlUrl");
      if (!xmlUrl) {
        return [];
      }

      return [
        {
          title:
            attribute(outline, "title") || attribute(outline, "text") || xmlUrl,
          xmlUrl,
          category: enclosingFolder(outline),
        },
      ];
    },
  );

  return { entries };
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (value: string) =>
  value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);

const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

const byTitle = (a: OpmlExportFeed, b: OpmlExportFeed) =>
  compareText(a.title, b.title);

const feedOutline = (feed: OpmlExportFeed, indent: string) => {
  const title = escapeXml(feed.title);
  return `${indent}<outline text="${title}" title="${title}" type="rss" xmlUrl="${escapeXml(feed.xmlUrl)}"/>`;
};

/**
 * Serialises by hand: the output is small and regular, and a builder library
 * is not worth a dependency. Uncategorised feeds come first, then categories
 * sorted by name, each with its feeds sorted by title — the sidebar's order.
 * Categories without feeds are left out; an empty folder would only make
 * another reader create an empty category.
 */
export const buildOpml = (
  title: string,
  categories: OpmlExportCategory[],
  createdAt: Date = new Date(),
): string => {
  const uncategorised = categories
    .filter((category) => category.name === null)
    .flatMap((category) => category.feeds)
    .sort(byTitle);

  const named = categories
    .filter(
      (category): category is OpmlExportCategory & { name: string } =>
        category.name !== null && category.feeds.length > 0,
    )
    .sort((a, b) => compareText(a.name, b.name));

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${escapeXml(title)}</title>`,
    `    <dateCreated>${createdAt.toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    ...uncategorised.map((feed) => feedOutline(feed, "    ")),
    ...named.flatMap((category) => {
      const name = escapeXml(category.name);
      return [
        `    <outline text="${name}" title="${name}">`,
        ...[...category.feeds]
          .sort(byTitle)
          .map((feed) => feedOutline(feed, "      ")),
        "    </outline>",
      ];
    }),
    "  </body>",
    "</opml>",
    "",
  ];

  return lines.join("\n");
};
