import FeedForm from "@/components/feed/feed-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Feed } from "@/generated/prisma/client";
import { DEFAULT_DISINTERESTS } from "@/lib/feedFilters";
import {
  getFeedFilters,
  getUserCategories,
} from "@/lib/repository/feedRepository";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/feedRepository", () => ({
  createFeed: vi.fn().mockResolvedValue(undefined),
  updateFeed: vi.fn().mockResolvedValue(undefined),
  getUserCategories: vi.fn(),
  getFeedFilters: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// FeedForm relies on DialogClose from Radix, which throws if rendered outside
// a Dialog — this mirrors how the app always mounts it, inside
// add-feed-form-dialog-trigger.tsx / edit-feed-dialog.tsx.
const renderForm = (editFeed?: Feed) =>
  render(
    <Dialog open>
      <DialogContent>
        <FeedForm editFeed={editFeed} onSubmitComplete={vi.fn()} />
      </DialogContent>
    </Dialog>,
  );

const makeFeed = (): Feed =>
  ({
    id: 1,
    title: "Existing Feed",
    link: "https://example.com/feed.xml",
    userId: "user-1",
    autoRefresh: true,
    lastFetched: new Date(0),
    createdAt: new Date(),
    updatedAt: new Date(),
    feedCategoryId: null,
  }) as Feed;

describe("FeedForm", () => {
  it("prefills the default disinterests as removable badges for a new feed", async () => {
    vi.mocked(getUserCategories).mockResolvedValue([]);

    renderForm();

    for (const keyword of DEFAULT_DISINTERESTS) {
      expect(
        await screen.findByRole("button", { name: `Remove ${keyword}` }),
      ).toBeTruthy();
    }
  });

  it("does not prefill the default disinterests when editing an existing feed", async () => {
    vi.mocked(getUserCategories).mockResolvedValue([]);
    // The edited feed has no disinterests of its own — proving the empty
    // list on screen came from getFeedFilters, not from the defaults the
    // new-feed branch prefills.
    vi.mocked(getFeedFilters).mockResolvedValue({
      interests: [],
      disinterests: [],
    });

    renderForm(makeFeed());

    // Wait for the async getFeedFilters load to land before asserting
    // absence, so the check isn't just faster than the effect. The submit
    // button stays disabled (see feed-form.tsx's filtersLoaded gate) until
    // that load has finished.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Update" })).not.toBeDisabled(),
    );
    expect(getFeedFilters).toHaveBeenCalledWith(1);

    for (const keyword of DEFAULT_DISINTERESTS) {
      expect(
        screen.queryByRole("button", { name: `Remove ${keyword}` }),
      ).toBeNull();
    }
  });
});
