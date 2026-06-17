import ToggleReadButton from "@/components/article/toggle-read-button";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/articleRepository", () => ({
  markArticleAsRead: vi.fn().mockResolvedValue(undefined),
  unmarkArticleAsRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const unreadArticle = {
  id: 1,
  readAt: null,
  title: "Test article",
} as any;

describe("ToggleReadButton", () => {
  it("calls onAfterDismiss after marking as read", async () => {
    const onAfterDismiss = vi.fn();
    render(
      <ToggleReadButton
        article={unreadArticle}
        onAfterDismiss={onAfterDismiss}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onAfterDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onAfterDismiss when unmarking as read", async () => {
    const onAfterDismiss = vi.fn();
    const readArticle = { ...unreadArticle, readAt: new Date() };
    render(
      <ToggleReadButton
        article={readArticle}
        onAfterDismiss={onAfterDismiss}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /restore/i }));

    expect(onAfterDismiss).not.toHaveBeenCalled();
  });
});
