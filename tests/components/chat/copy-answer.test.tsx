import { CopyAnswer } from "@/components/chat/copy-answer";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const ANSWER = "## Markets\n\n- Alphabet **rose**.";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("CopyAnswer", () => {
  it("copies the answer's Markdown", async () => {
    const user = userEvent.setup();
    render(<CopyAnswer text={ANSWER} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(ANSWER);
  });

  it("offers to copy again after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CopyAnswer text={ANSWER} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" });
    act(() => vi.advanceTimersByTime(2000));

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("reports a clipboard the page may not write to", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    render(<CopyAnswer text={ANSWER} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      "This answer could not be copied.",
      { id: "chat-copy" },
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
