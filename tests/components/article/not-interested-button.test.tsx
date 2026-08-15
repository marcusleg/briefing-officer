import NotInterestedButton from "@/components/article/not-interested-button";
import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";
import { markArticleAsNotInteresting } from "@/lib/repository/articleRepository";
import { addFeedFilter } from "@/lib/repository/feedRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsNotInteresting: vi.fn().mockResolvedValue(undefined),
  restoreArticleStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repository/feedRepository", () => ({
  addFeedFilter: vi.fn().mockResolvedValue(undefined),
  removeFeedFilter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/services/filterSuggestionService", () => ({
  suggestFilterKeywords: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const article = {
  id: 1,
  feedId: 7,
  status: "UNREAD",
  title: "Test article",
} as any;

const openPopover = async () => {
  render(<NotInterestedButton article={article} />);
  await userEvent.click(screen.getByRole("button", { name: "Not interested" }));
};

describe("NotInterestedButton", () => {
  it("dismisses the article as soon as it is clicked", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue(["a", "b", "c"]);

    await openPopover();

    expect(markArticleAsNotInteresting).toHaveBeenCalledWith(1);
  });

  it("adds a suggestion to the feed's disinterests when its chip is clicked", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue([
      "USB driver development",
      "device drivers",
      "kernel internals",
    ]);

    await openPopover();
    await userEvent.click(
      await screen.findByRole("button", { name: "USB driver development" }),
    );

    expect(addFeedFilter).toHaveBeenCalledWith(
      7,
      "DISINTEREST",
      "USB driver development",
    );
  });

  it("offers the manual input while suggestions are still generating", async () => {
    vi.mocked(suggestFilterKeywords).mockReturnValue(new Promise(() => {}));

    await openPopover();

    expect(screen.getByLabelText("Add a keyword")).toBeTruthy();
  });

  it("offers the manual input when suggestions fail", async () => {
    vi.mocked(suggestFilterKeywords).mockRejectedValue(new Error("no model"));

    await openPopover();

    expect(await screen.findByText(/no suggestions/i)).toBeTruthy();
    expect(screen.getByLabelText("Add a keyword")).toBeTruthy();
  });

  it("adds a manually typed keyword", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue(["a", "b", "c"]);

    await openPopover();
    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "quarterly earnings roundups{Enter}",
    );

    expect(addFeedFilter).toHaveBeenCalledWith(
      7,
      "DISINTEREST",
      "quarterly earnings roundups",
    );
  });

  it("says that the change applies to future articles only", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue(["a", "b", "c"]);

    await openPopover();

    expect(screen.getByText(/applies to future articles/i)).toBeTruthy();
  });

  // Regression test for the popover unmounting itself: markArticleAsNotInteresting
  // used to revalidate the inbox list as a side effect, which — outside this
  // mocked-server-action test, in the real app — drops the just-dismissed
  // article out of the UNREAD query and unmounts this component's ArticleCard
  // (and the popover with it) before the reader can see the suggestions. The
  // fix defers revalidation to `router.refresh()`, called only when the
  // popover closes. This test proves the popover is still open and usable
  // — suggestion chips rendered, manual input present — after both
  // `markArticleAsNotInteresting` and `suggestFilterKeywords` have resolved,
  // and that no refresh (which would only belong on close) has happened yet.
  it("keeps the popover open and usable after the dismissal and suggestion fetch resolve", async () => {
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
      refresh,
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(suggestFilterKeywords).mockResolvedValue([
      "USB driver development",
      "device drivers",
      "kernel internals",
    ]);

    await openPopover();

    expect(markArticleAsNotInteresting).toHaveBeenCalledWith(1);
    expect(
      await screen.findByRole("button", { name: "USB driver development" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "device drivers" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "kernel internals" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Add a keyword")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not interested" })).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  // Regression test for the popover closing itself after the FIRST accepted
  // suggestion: addFeedFilter/removeFeedFilter used to revalidate the inbox
  // list as a side effect too, which — outside this mocked-server-action
  // test, in the real app — drops the just-dismissed article out of the
  // UNREAD query and unmounts this component's ArticleCard (and the popover
  // with it) as soon as a reader accepts one suggestion, before they can add
  // a second one, type a custom keyword, or reach Undo. The fix removes that
  // revalidation from both functions, deferring it to `router.refresh()` on
  // close, same as markArticleAsNotInteresting.
  //
  // Limitation: this test mocks addFeedFilter/removeFeedFilter, so it cannot
  // reproduce the server-side revalidation that actually caused the bug. It
  // only guards the component's own state handling — that accepting a chip
  // does not itself close the popover — not the server action's behaviour.
  it("keeps the popover open with remaining suggestions and manual input after a chip is accepted", async () => {
    vi.mocked(suggestFilterKeywords).mockResolvedValue([
      "USB driver development",
      "device drivers",
      "kernel internals",
    ]);

    await openPopover();
    await userEvent.click(
      await screen.findByRole("button", { name: "USB driver development" }),
    );

    expect(addFeedFilter).toHaveBeenCalledWith(
      7,
      "DISINTEREST",
      "USB driver development",
    );
    expect(
      screen.queryByRole("button", { name: "USB driver development" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "device drivers" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "kernel internals" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Add a keyword")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });
});
