import NotInterestedButton from "@/components/article/not-interested-button";
import { suggestFilterKeywords } from "@/lib/ai/services/filterSuggestionService";
import { markArticleAsNotInteresting } from "@/lib/repository/articleRepository";
import { addFeedFilter } from "@/lib/repository/feedRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
