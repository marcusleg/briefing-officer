import ArticleList from "@/components/article/article-list";
import { ArticleOverridesProvider } from "@/components/article/article-overrides";
import { ArticleScope, INBOX_SCOPE } from "@/lib/articleScope";
import {
  markArticleAsRead,
  markArticleAsReadLater,
  restoreArticleStatus,
  unmarkArticleAsStarred,
} from "@/lib/repository/articleRepository";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Action, toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn(),
  markArticleAsReadLater: vi.fn(),
  markArticleAsStarred: vi.fn(),
  restoreArticleStatus: vi.fn(),
  restoreArticleToInbox: vi.fn(),
  unmarkArticleAsReadLater: vi.fn(),
  unmarkArticleAsStarred: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("@/lib/ai/services/filterSuggestionService", () => ({
  suggestFilterKeywords: vi.fn(),
}));

vi.mock("@/lib/repository/feedRepository", () => ({
  addFeedFilter: vi.fn(),
  removeFeedFilter: vi.fn(),
}));

/**
 * A save that waits, as one sent without a connection does, until the test is
 * over. React holds overlapping async transitions until all of them settle, so
 * one left pending would hold back the next test's.
 */
const reconnect: Array<() => void> = [];
const offline = () =>
  new Promise<undefined>((resolve) => reconnect.push(() => resolve(undefined)));

afterEach(async () => {
  await act(async () => reconnect.splice(0).forEach((resolve) => resolve()));
  vi.resetAllMocks();
});

const article = (
  id: number,
  overrides: Partial<{
    status: "UNREAD" | "READ_LATER" | "READ";
    starred: boolean;
    day: number;
  }> = {},
) =>
  ({
    id,
    title: `Article ${id}`,
    link: `https://example.com/${id}`,
    publicationDate: new Date(Date.UTC(2026, 8, overrides.day ?? id)),
    status: overrides.status ?? "UNREAD",
    starred: overrides.starred ?? false,
    filterReason: null,
    feedId: 1,
    feed: { id: 1, title: "Feed" },
    lead: { text: `Lead ${id}` },
    scrape: { textContent: "body", author: "" },
  }) as any;

const renderList = (
  articles: any[],
  scope: ArticleScope = INBOX_SCOPE,
  readLaterHeading?: React.ReactNode,
) =>
  render(
    <ArticleOverridesProvider>
      <ArticleList
        articles={articles}
        scope={scope}
        readLaterHeading={readLaterHeading}
      />
    </ArticleOverridesProvider>,
  );

const cardOf = (title: string) =>
  screen.getByText(title).closest('[data-slot="card"]') as HTMLElement;

// Each card renders its actions twice, once per breakpoint; either will do.
const clickIn = async (title: string, name: RegExp) =>
  userEvent.click(within(cardOf(title)).getAllByRole("button", { name })[0]);

// The icon-only actions carry their name in a tooltip, so find them by icon.
const iconButtonIn = (title: string, icon: string) =>
  within(cardOf(title))
    .getAllByRole("button")
    .find((button) => button.querySelector(`.${icon}`))!;

describe("optimistic article changes", () => {
  it("drops a dismissed article at once while its save is still waiting", async () => {
    vi.mocked(markArticleAsRead).mockImplementation(offline);
    renderList([article(1), article(2)]);

    await clickIn("Article 1", /dismiss/i);

    expect(markArticleAsRead).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Article 1")).toBeNull();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
  });

  it("brings the article back and says so when the save fails", async () => {
    let fail: (error: Error) => void = () => {};
    vi.mocked(markArticleAsRead).mockImplementation(
      () => new Promise((_, reject) => (fail = reject)),
    );
    renderList([article(1)]);

    await clickIn("Article 1", /dismiss/i);
    expect(screen.queryByText("Article 1")).toBeNull();

    await act(async () => fail(new Error("Not found")));

    expect(await screen.findByText("Article 1")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it("shows an Undo made before the dismissal was saved", async () => {
    vi.mocked(markArticleAsRead).mockImplementation(offline);
    vi.mocked(restoreArticleStatus).mockImplementation(offline);
    renderList([article(1)]);

    await clickIn("Article 1", /dismiss/i);
    const [, options] = vi.mocked(toast).mock.calls[0];
    await act(async () => (options!.action as Action).onClick({} as never));

    expect(restoreArticleStatus).toHaveBeenCalledWith(1, "UNREAD");
    expect(screen.getByText("Article 1")).toBeInTheDocument();
  });

  it("keeps a dismissed article, faded, on a list that shows read ones too", async () => {
    vi.mocked(markArticleAsRead).mockImplementation(offline);
    renderList([article(1)], { statuses: ["UNREAD", "READ"] });

    await clickIn("Article 1", /dismiss/i);

    expect(cardOf("Article 1")).toHaveClass("opacity-65");
    expect(
      within(cardOf("Article 1")).getAllByRole("button", { name: /restore/i }),
    ).not.toHaveLength(0);
  });

  it("drops an unstarred article from the starred list at once", async () => {
    vi.mocked(unmarkArticleAsStarred).mockImplementation(offline);
    renderList([article(1, { starred: true })], { starredOnly: true });

    await userEvent.click(iconButtonIn("Article 1", "lucide-star"));

    expect(unmarkArticleAsStarred).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Article 1")).toBeNull();
  });

  it("moves an article under the Read Later heading at once", async () => {
    vi.mocked(markArticleAsReadLater).mockImplementation(offline);
    renderList(
      [
        article(2, { day: 20 }),
        article(1, { day: 10 }),
        article(3, { status: "READ_LATER", day: 1 }),
      ],
      INBOX_SCOPE,
      <h3>Read Later</h3>,
    );

    await userEvent.click(iconButtonIn("Article 2", "lucide-bookmark"));

    const order = screen
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(order).toEqual([
      "Article 1",
      "Read Later",
      "Article 3",
      "Article 2",
    ]);
  });
});
