import { buildOpml, InvalidOpmlError, isHttpUrl, parseOpml } from "@/lib/opml";
import { describe, expect, it } from "vitest";

const wrap = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Subscriptions</title></head>
  <body>
${body}
  </body>
</opml>`;

describe("parseOpml", () => {
  it("reads a flat list of feeds as uncategorised entries", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline type="rss" text="One" title="One" xmlUrl="https://one.example/feed"/>
         <outline type="rss" text="Two" title="Two" xmlUrl="https://two.example/feed"/>`,
      ),
    );

    expect(entries).toEqual([
      { title: "One", xmlUrl: "https://one.example/feed", category: null },
      { title: "Two", xmlUrl: "https://two.example/feed", category: null },
    ]);
  });

  it("uses the enclosing folder as the category", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline text="Tech" title="Tech">
           <outline type="rss" text="One" xmlUrl="https://one.example/feed"/>
         </outline>
         <outline type="rss" text="Loose" xmlUrl="https://loose.example/feed"/>`,
      ),
    );

    expect(entries).toEqual([
      { title: "One", xmlUrl: "https://one.example/feed", category: "Tech" },
      { title: "Loose", xmlUrl: "https://loose.example/feed", category: null },
    ]);
  });

  it("flattens nested folders to the innermost one", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline text="Tech">
           <outline text="Linux">
             <outline type="rss" text="LWN" xmlUrl="https://lwn.example/feed"/>
           </outline>
         </outline>`,
      ),
    );

    expect(entries[0].category).toBe("Linux");
  });

  it("prefers title over text, and falls back to the URL when both are missing", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline type="rss" text="From text" title="From title" xmlUrl="https://a.example/feed"/>
         <outline type="rss" text="Only text" xmlUrl="https://b.example/feed"/>
         <outline type="rss" xmlUrl="https://c.example/feed"/>`,
      ),
    );

    expect(entries.map((entry) => entry.title)).toEqual([
      "From title",
      "Only text",
      "https://c.example/feed",
    ]);
  });

  it("ignores outlines without an xmlUrl that contain no feeds", () => {
    const { entries } = parseOpml(
      wrap(`<outline text="Empty folder"/><outline text="Just a note"/>`),
    );

    expect(entries).toEqual([]);
  });

  it("decodes entities in attributes and trims whitespace", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline text="Tom &amp; Jerry">
           <outline type="rss" text=" Cats " xmlUrl="https://x.example/feed?a=1&amp;b=2"/>
         </outline>`,
      ),
    );

    expect(entries).toEqual([
      {
        title: "Cats",
        xmlUrl: "https://x.example/feed?a=1&b=2",
        category: "Tom & Jerry",
      },
    ]);
  });

  it("matches attribute names case-insensitively", () => {
    const { entries } = parseOpml(
      wrap(
        `<outline type="rss" text="Lower" xmlurl="https://l.example/feed"/>`,
      ),
    );

    expect(entries[0].xmlUrl).toBe("https://l.example/feed");
  });

  it("throws InvalidOpmlError for text that is not OPML", () => {
    expect(() => parseOpml("hello")).toThrow(InvalidOpmlError);
    expect(() => parseOpml("<rss><channel/></rss>")).toThrow(InvalidOpmlError);
    expect(() => parseOpml('<opml version="2.0"><head/></opml>')).toThrow(
      "This file is not an OPML document.",
    );
  });
});

describe("buildOpml", () => {
  const createdAt = new Date(Date.UTC(2026, 8, 13, 10, 0, 0));

  it("writes uncategorised feeds at body level and categories as nested outlines", () => {
    const opml = buildOpml(
      "Briefing Officer feeds",
      [
        {
          name: null,
          feeds: [{ title: "Loose", xmlUrl: "https://loose.example/feed" }],
        },
        {
          name: "Tech",
          feeds: [{ title: "LWN", xmlUrl: "https://lwn.example/feed" }],
        },
      ],
      createdAt,
    );

    expect(opml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Briefing Officer feeds</title>
    <dateCreated>Sun, 13 Sep 2026 10:00:00 GMT</dateCreated>
  </head>
  <body>
    <outline text="Loose" title="Loose" type="rss" xmlUrl="https://loose.example/feed"/>
    <outline text="Tech" title="Tech">
      <outline text="LWN" title="LWN" type="rss" xmlUrl="https://lwn.example/feed"/>
    </outline>
  </body>
</opml>
`);
  });

  it("escapes XML special characters in titles and URLs", () => {
    const opml = buildOpml(
      "T <&>",
      [
        {
          name: 'A & "B"',
          feeds: [{ title: "<b>", xmlUrl: "https://x.example/?a=1&b=2" }],
        },
      ],
      createdAt,
    );

    expect(opml).toContain("<title>T &lt;&amp;&gt;</title>");
    expect(opml).toContain('text="A &amp; &quot;B&quot;"');
    expect(opml).toContain('text="&lt;b&gt;"');
    expect(opml).toContain('xmlUrl="https://x.example/?a=1&amp;b=2"');
  });

  it("sorts categories by name and feeds by title, case-insensitively", () => {
    const opml = buildOpml(
      "t",
      [
        {
          name: "zebra",
          feeds: [
            { title: "beta", xmlUrl: "https://b.example" },
            { title: "Alpha", xmlUrl: "https://a.example" },
          ],
        },
        { name: "Apple", feeds: [{ title: "x", xmlUrl: "https://x.example" }] },
        {
          name: null,
          feeds: [
            { title: "Second", xmlUrl: "https://2.example" },
            { title: "first", xmlUrl: "https://1.example" },
          ],
        },
      ],
      createdAt,
    );

    const order = [...opml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual([
      "first",
      "Second",
      "Apple",
      "x",
      "zebra",
      "Alpha",
      "beta",
    ]);
  });

  it("omits categories that have no feeds", () => {
    const opml = buildOpml("t", [{ name: "Empty", feeds: [] }], createdAt);

    expect(opml).not.toContain("Empty");
  });

  it("parses its own output back to the same entries", () => {
    const opml = buildOpml(
      "t",
      [
        {
          name: null,
          feeds: [{ title: "Loose", xmlUrl: "https://loose.example/feed" }],
        },
        {
          name: "Tech",
          feeds: [{ title: "LWN", xmlUrl: "https://lwn.example/feed" }],
        },
      ],
      createdAt,
    );

    expect(parseOpml(opml).entries).toEqual([
      { title: "Loose", xmlUrl: "https://loose.example/feed", category: null },
      { title: "LWN", xmlUrl: "https://lwn.example/feed", category: "Tech" },
    ]);
  });
});

describe("isHttpUrl", () => {
  it("accepts absolute http and https URLs only", () => {
    expect(isHttpUrl("https://example.com/feed")).toBe(true);
    expect(isHttpUrl("http://example.com/feed")).toBe(true);
    expect(isHttpUrl("ftp://example.com/feed")).toBe(false);
    expect(isHttpUrl("example.com/feed")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
