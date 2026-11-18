import ArticleCard from "@/components/article/article-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  markArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  markArticleAsStarred: vi.fn().mockResolvedValue(undefined),
  markArticleAsNotInteresting: vi.fn().mockResolvedValue(undefined),
  restoreArticleStatus: vi.fn().mockResolvedValue(undefined),
  restoreArticleToInbox: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsReadLater: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsStarred: vi.fn().mockResolvedValue(undefined),
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
  title: "Kernel 7.2 removes strncpy",
  link: "https://example.com/article",
  commentsLink: null,
  publicationDate: new Date("2026-09-01T00:00:00Z"),
  status: "UNREAD",
  starred: false,
  filterReason: null,
  feedId: 1,
  feed: { id: 1, title: "Feed" },
  lead: { text: "The kernel drops strncpy after years of cleanup." },
  scrape: { textContent: "body", author: "" },
} as any;

describe("ArticleCard", () => {
  it("shows the lead once the worker has written it", () => {
    render(<ArticleCard article={article} />);

    expect(
      screen.getByText("The kernel drops strncpy after years of cleanup."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("announces that the summary is being written while the lead is missing", () => {
    render(<ArticleCard article={{ ...article, lead: null }} />);

    expect(
      screen.getByRole("status", { name: "Writing summary" }),
    ).toBeInTheDocument();
  });

  it("points to the original article when there is no scraped text", () => {
    render(<ArticleCard article={{ ...article, lead: null, scrape: null }} />);

    expect(screen.getByText(/no content available/i)).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
