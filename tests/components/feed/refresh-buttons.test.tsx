import RefreshFeedButton from "@/app/feed/[feedId]/refresh-feed-button";
import RefreshCategoryButton from "@/app/feed/category/[categoryId]/refresh-category-button";
import RefreshAllFeedsButton from "@/app/feed/refresh-all-feeds-button";
import { LiveUpdatesContext } from "@/components/live-updates";
import {
  refreshCategoryFeeds,
  refreshFeed,
  refreshFeeds,
} from "@/lib/repository/feedRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/feedRepository", () => ({
  refreshFeed: vi.fn().mockResolvedValue(undefined),
  refreshFeeds: vi.fn().mockResolvedValue(undefined),
  refreshCategoryFeeds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { message: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const noteUserRefresh = vi.fn();

const renderWithContext = (ui: React.ReactElement) =>
  render(
    <LiveUpdatesContext.Provider
      value={{ userRefreshActive: false, noteUserRefresh }}
    >
      {ui}
    </LiveUpdatesContext.Provider>,
  );

const STARTED = "Refresh started. New articles will appear as they arrive.";

describe("refresh buttons", () => {
  it("Refresh all queues every feed and notes the user refresh", async () => {
    renderWithContext(<RefreshAllFeedsButton />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshFeeds).toHaveBeenCalledOnce();
    expect(toast.message).toHaveBeenCalledWith(STARTED);
    expect(noteUserRefresh).toHaveBeenCalledOnce();
  });

  it("Refresh feed queues that feed and notes the user refresh", async () => {
    renderWithContext(<RefreshFeedButton feedId={7} />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshFeed).toHaveBeenCalledWith(7);
    expect(toast.message).toHaveBeenCalledWith(STARTED);
    expect(noteUserRefresh).toHaveBeenCalledOnce();
  });

  it("Refresh category queues that category and notes the user refresh", async () => {
    renderWithContext(<RefreshCategoryButton categoryId={3} />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshCategoryFeeds).toHaveBeenCalledWith(3);
    expect(toast.message).toHaveBeenCalledWith(STARTED);
    expect(noteUserRefresh).toHaveBeenCalledOnce();
  });

  it("shows an error and does not note a user refresh when queuing fails", async () => {
    vi.mocked(refreshFeed).mockRejectedValueOnce(new Error("nope"));
    renderWithContext(<RefreshFeedButton feedId={7} />);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(toast.error).toHaveBeenCalled();
    expect(toast.message).not.toHaveBeenCalled();
    expect(noteUserRefresh).not.toHaveBeenCalled();
  });
});
