import DismissButton from "@/components/article/dismiss-button";
import { restoreArticleStatus } from "@/lib/repository/articleRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Action, toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  restoreArticleToInbox: vi.fn().mockResolvedValue(undefined),
  restoreArticleStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

// The "components" project has no global mock-clearing setup (unlike the
// "node" project's vitest.setup.ts), so the toast mock's call history would
// otherwise accumulate across tests in this file — and the Undo test below
// depends on `mock.calls[0]` being its own click, not an earlier test's.
afterEach(() => {
  vi.clearAllMocks();
});

const unreadArticle = {
  id: 1,
  status: "UNREAD",
  title: "Test article",
} as any;

describe("DismissButton", () => {
  it("calls onAfterDismiss after marking as read", async () => {
    const onAfterDismiss = vi.fn();
    render(
      <DismissButton article={unreadArticle} onAfterDismiss={onAfterDismiss} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onAfterDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onAfterDismiss when unmarking as read", async () => {
    const onAfterDismiss = vi.fn();
    const readArticle = { ...unreadArticle, status: "READ" };
    render(
      <DismissButton article={readArticle} onAfterDismiss={onAfterDismiss} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /restore/i }));

    expect(onAfterDismiss).not.toHaveBeenCalled();
  });

  it.each(["READ", "FILTERED", "NOT_INTERESTED"] as const)(
    "offers Restore for a %s article",
    (status) => {
      render(<DismissButton article={{ ...unreadArticle, status }} />);

      expect(screen.getByRole("button", { name: /restore/i })).toBeTruthy();
    },
  );

  it("undoes a restore back to the status the article actually held", async () => {
    const filtered = { ...unreadArticle, status: "FILTERED" };
    render(<DismissButton article={filtered} />);

    await userEvent.click(screen.getByRole("button", { name: /restore/i }));

    const [, options] = vi.mocked(toast).mock.calls[0];
    await (options!.action as Action).onClick({} as never);

    expect(restoreArticleStatus).toHaveBeenCalledWith(1, "FILTERED");
  });
});
