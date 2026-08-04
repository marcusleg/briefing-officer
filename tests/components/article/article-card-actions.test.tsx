import ArticleCardActions from "@/components/article/article-card-actions";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

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

afterEach(() => vi.unstubAllGlobals());

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
  it("renders a read-aloud button in both layouts when leadText is set", () => {
    installSpeechEngine();

    render(<ArticleCardActions article={article} leadText="A lead." />);

    // Both the mobile (md:hidden) and desktop (hidden md:flex) layouts render
    // into the DOM simultaneously; CSS, not JS, decides which is visible.
    const buttons = screen.getAllByRole("button", { name: /read aloud/i });
    expect(buttons).toHaveLength(2);
  });

  it("renders no read-aloud button when leadText is absent", () => {
    installSpeechEngine();

    render(<ArticleCardActions article={article} />);

    expect(
      screen.queryByRole("button", { name: /read aloud/i }),
    ).not.toBeInTheDocument();
  });
});
