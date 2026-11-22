import {
  SafeMarkdown,
  type SafeMarkdownProps,
} from "@/components/markdown/safe-markdown";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

const MARKDOWN = [
  "See [source](https://example.com/a).",
  "",
  "![chart](https://evil.example/p.png)",
  "",
  "Done.",
].join("\n");

describe("SafeMarkdown", () => {
  it("keeps its own link and image handling over caller components", async () => {
    const UnsafeLink = vi.fn((props: ComponentProps<"a">) => <a {...props} />);
    const UnsafeImage = vi.fn((props: ComponentProps<"img">) => (
      // eslint-disable-next-line @next/next/no-img-element -- a hostile override
      <img alt="" {...props} />
    ));
    const components = {
      a: UnsafeLink,
      img: UnsafeImage,
    } as SafeMarkdownProps["components"];

    const { container } = render(
      <SafeMarkdown components={components}>{MARKDOWN}</SafeMarkdown>,
    );

    await screen.findByText(/Done\./);
    const link = screen.getByRole("link", { name: "source" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(UnsafeLink).not.toHaveBeenCalled();
    expect(UnsafeImage).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("chart");
  });

  it("passes no Streamdown props beyond its own on to Streamdown", async () => {
    const BlockComponent = vi.fn(() => (
      // eslint-disable-next-line @next/next/no-img-element -- a hostile override
      <img src="https://evil.example/block.png" alt="" />
    ));
    const props = {
      BlockComponent,
      urlTransform: () => "https://evil.example/u",
      "data-leak": "yes",
    } as Partial<SafeMarkdownProps>;

    const { container } = render(
      <SafeMarkdown {...props}>{MARKDOWN}</SafeMarkdown>,
    );

    await screen.findByText(/Done\./);
    expect(BlockComponent).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-leak]")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
  });

  it("opens a link where newTabHref sends it, in a new tab", async () => {
    render(
      <SafeMarkdown
        newTabHref={(href) =>
          href === "/feed/1/article/2/text-summary"
            ? "https://news.example/a"
            : undefined
        }
      >
        {"[cited](/feed/1/article/2/text-summary) and [feeds](/feed)"}
      </SafeMarkdown>,
    );

    const cited = await screen.findByRole("link", { name: "cited" });
    expect(cited).toHaveAttribute("href", "https://news.example/a");
    expect(screen.getByText("(news.example)")).toBeInTheDocument();
    expect(cited).toHaveAttribute("target", "_blank");
    expect(cited).toHaveAttribute("rel", "noopener noreferrer");
    const feeds = screen.getByRole("link", { name: "feeds" });
    expect(feeds).toHaveAttribute("href", "/feed");
    expect(feeds).not.toHaveAttribute("target");
  });

  it("shows a link as text where newTabHref says so", async () => {
    render(
      <SafeMarkdown newTabHref={() => null}>
        {"See [the report](https://evil.example/?d=secret)."}
      </SafeMarkdown>,
    );

    await screen.findByText("the report");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
