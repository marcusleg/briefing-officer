import ArticleCardActions from "@/components/article/article-card-actions";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  restoreArticleToInbox: vi.fn().mockResolvedValue(undefined),
  restoreArticleStatus: vi.fn().mockResolvedValue(undefined),
  markArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  markArticleAsStarred: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsStarred: vi.fn().mockResolvedValue(undefined),
  markArticleAsNotInteresting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/ai/services/filterSuggestionService", () => ({
  suggestFilterKeywords: vi.fn(),
}));

vi.mock("@/lib/repository/feedRepository", () => ({
  addFeedFilter: vi.fn().mockResolvedValue(undefined),
  removeFeedFilter: vi.fn().mockResolvedValue(undefined),
}));

const article = {
  id: 1,
  feedId: 1,
  title: "Kernel 7.2 removes strncpy",
  link: "https://example.com/article",
  commentsLink: null,
  status: "UNREAD",
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

  it("hides the text summary entry on the text summary page", () => {
    render(<ArticleCardActions article={article} currentPage="text-summary" />);

    expect(
      screen.queryByRole("link", { name: /text summary/i }),
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
    expect(screen.getAllByRole("link", { name: /text summary/i })).toHaveLength(
      2,
    );
  });

  it("offers the not-interested action for an inbox article", () => {
    render(<ArticleCardActions article={article} />);

    // Mobile and desktop layouts both render into the DOM at once (see
    // above), so the action appears twice.
    expect(
      screen.getAllByRole("button", { name: /not interested/i }),
    ).toHaveLength(2);
  });

  it("hides the not-interested action for an already-rejected article", () => {
    render(<ArticleCardActions article={{ ...article, status: "FILTERED" }} />);

    expect(
      screen.queryAllByRole("button", { name: /not interested/i }),
    ).toHaveLength(0);
  });
});
