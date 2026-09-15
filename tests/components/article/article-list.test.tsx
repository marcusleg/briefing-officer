import ArticleList from "@/components/article/article-list";
import { LiveUpdatesContext } from "@/components/live-updates";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const article = (id: number, title = `Article ${id}`) =>
  ({
    id,
    title,
    link: `https://example.com/${id}`,
    publicationDate: new Date("2026-09-01T00:00:00Z"),
    status: "UNREAD",
    starred: false,
    filterReason: null,
    feedId: 1,
    feed: { id: 1, title: "Feed" },
    lead: { text: `Lead ${id}` },
    scrape: { textContent: "body", author: "" },
  }) as any;

const cardOf = (title: string) =>
  screen.getByText(title).closest('[data-slot="card"]');

describe("ArticleList", () => {
  it("shows every article it mounts with", () => {
    render(<ArticleList articles={[article(1), article(2)]} />);

    expect(screen.getByText("Article 1")).toBeInTheDocument();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("holds back articles that arrive later and counts them", () => {
    const { rerender } = render(<ArticleList articles={[article(2)]} />);

    rerender(<ArticleList articles={[article(3), article(2)]} />);

    expect(screen.queryByText("Article 3")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show 1 new article" }),
    ).toBeInTheDocument();

    rerender(<ArticleList articles={[article(4), article(3), article(2)]} />);
    expect(
      screen.getByRole("button", { name: "Show 2 new articles" }),
    ).toBeInTheDocument();
  });

  it("merges held articles in server order when the button is clicked", async () => {
    const { rerender } = render(<ArticleList articles={[article(2)]} />);
    rerender(<ArticleList articles={[article(3), article(2)]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Show 1 new article" }),
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Article 3",
      "Article 2",
    ]);
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("keeps the highlighted article when held articles are shown", async () => {
    const { rerender } = render(
      <ArticleList articles={[article(2), article(1)]} />,
    );
    await userEvent.click(screen.getByText("Article 1"));
    rerender(<ArticleList articles={[article(3), article(2), article(1)]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Show 1 new article" }),
    );

    expect(cardOf("Article 1")).toHaveClass("border-foreground");
    expect(cardOf("Article 2")).not.toHaveClass("border-foreground");
    expect(cardOf("Article 3")).not.toHaveClass("border-foreground");
  });

  it("updates an article already on screen in place", () => {
    const { rerender } = render(<ArticleList articles={[article(1)]} />);

    rerender(<ArticleList articles={[article(1, "Article 1 (updated)")]} />);

    expect(screen.getByText("Article 1 (updated)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("drops an article the server no longer returns", () => {
    const { rerender } = render(
      <ArticleList articles={[article(1), article(2)]} />,
    );

    rerender(<ArticleList articles={[article(2)]} />);

    expect(screen.queryByText("Article 1")).toBeNull();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
  });

  it("merges new articles at once while a user refresh is active", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LiveUpdatesContext.Provider
        value={{ userRefreshActive: true, noteUserRefresh: () => {} }}
      >
        {children}
      </LiveUpdatesContext.Provider>
    );
    const { rerender } = render(<ArticleList articles={[article(2)]} />, {
      wrapper,
    });

    rerender(<ArticleList articles={[article(3), article(2)]} />);

    expect(screen.getByText("Article 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new article/ })).toBeNull();
  });

  it("highlights the article that took the place of one marked as read", async () => {
    const { rerender } = render(
      <ArticleList articles={[article(1), article(2), article(3)]} />,
    );
    await userEvent.keyboard("n");
    await userEvent.keyboard("m");

    rerender(<ArticleList articles={[article(2), article(3)]} />);

    expect(cardOf("Article 2")).toHaveClass("border-foreground");
    expect(cardOf("Article 3")).not.toHaveClass("border-foreground");
  });

  it("continues past the moved highlight when the reader presses n", async () => {
    const { rerender } = render(
      <ArticleList articles={[article(1), article(2), article(3)]} />,
    );
    await userEvent.keyboard("n");
    await userEvent.keyboard("m");
    rerender(<ArticleList articles={[article(2), article(3)]} />);

    await userEvent.keyboard("n");

    expect(cardOf("Article 3")).toHaveClass("border-foreground");
    expect(cardOf("Article 2")).not.toHaveClass("border-foreground");
  });

  it("highlights the new last article when the last one is marked as read", async () => {
    const { rerender } = render(
      <ArticleList articles={[article(1), article(2)]} />,
    );
    await userEvent.keyboard("n");
    await userEvent.keyboard("n");
    await userEvent.keyboard("m");

    rerender(<ArticleList articles={[article(1)]} />);

    expect(cardOf("Article 1")).toHaveClass("border-foreground");
  });

  it("highlights nothing when the last remaining article is marked as read", async () => {
    const { rerender } = render(<ArticleList articles={[article(1)]} />);
    await userEvent.keyboard("n");
    await userEvent.keyboard("m");

    rerender(<ArticleList articles={[]} />);

    expect(screen.queryByText("Article 1")).toBeNull();
  });
});
