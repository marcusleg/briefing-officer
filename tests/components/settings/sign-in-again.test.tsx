import SignInAgain from "@/app/settings/sign-in-again";
import { authClient } from "@/lib/auth-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReset();
});

describe("SignInAgain", () => {
  it("explains why the sessions are hidden", () => {
    render(<SignInAgain />);

    expect(
      screen.getByText(
        "For your security, sign in again to see your sessions.",
      ),
    ).toBeInTheDocument();
  });

  it("signs out and returns to settings after signing in", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: {} } as never);
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as never);
    const user = userEvent.setup();
    render(<SignInAgain />);

    await user.click(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/sign-in?callbackURL=/settings"),
    );
    expect(authClient.signOut).toHaveBeenCalled();
  });

  it("shows an error and stays put when signing out fails", async () => {
    vi.mocked(authClient.signOut).mockRejectedValue(new Error("offline"));
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as never);
    const user = userEvent.setup();
    render(<SignInAgain />);

    await user.click(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not sign out"),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
