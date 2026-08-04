import ArticleCardActions from "@/components/article/article-card-actions";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsRead: vi.fn().mockResolvedValue(undefined),
  markArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  markArticleAsStarred: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsStarred: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const article = {
  id: 1,
  feedId: 1,
  title: "Kernel 7.2 removes strncpy",
  link: "https://example.com/article",
  commentsLink: null,
  readAt: null,
  readLater: false,
  starred: false,
} as any;

describe("ArticleCardActions", () => {
  it("links to the audio summary page in both layouts", () => {
    render(<ArticleCardActions article={article} />);

    // Both the mobile (md:hidden) and desktop (hidden md:flex) layouts render
    // into the DOM simultaneously; CSS, not JS, decides which is visible.
    const links = screen.getAllByRole("link", { name: /audio summary/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/feed/1/article/1/audio-summary");
  });

  it("hides the summarize entry on the AI summary page", () => {
    render(<ArticleCardActions article={article} currentPage="ai-summary" />);

    expect(
      screen.queryByRole("link", { name: /summarize/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /audio summary/i }),
    ).toHaveLength(2);
  });

  it("hides the audio entry on the audio summary page", () => {
    render(
      <ArticleCardActions article={article} currentPage="audio-summary" />,
    );

    expect(
      screen.queryByRole("link", { name: /audio summary/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /summarize/i })).toHaveLength(2);
  });
});
