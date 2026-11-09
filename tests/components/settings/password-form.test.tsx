import PasswordForm from "@/app/settings/password-form";
import { authClient } from "@/lib/auth-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const submitPasswords = async (
  current: string,
  next: string,
  confirm: string,
) => {
  const user = userEvent.setup();
  render(<PasswordForm />);
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Change password" }));
};

describe("PasswordForm", () => {
  it("changes the password and signs out other sessions", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      data: {},
    } as never);

    await submitPasswords("old-secret", "new-secret-1", "new-secret-1");

    expect(authClient.changePassword).toHaveBeenCalledWith({
      currentPassword: "old-secret",
      newPassword: "new-secret-1",
      revokeOtherSessions: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Password changed");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("requires 8 characters", async () => {
    await submitPasswords("old-secret", "short", "short");

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(authClient.changePassword).not.toHaveBeenCalled();
  });

  it("requires matching passwords", async () => {
    await submitPasswords("old-secret", "new-secret-1", "new-secret-2");

    expect(
      await screen.findByText("Passwords don't match"),
    ).toBeInTheDocument();
    expect(authClient.changePassword).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the error has none", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      error: {},
    } as never);

    await submitPasswords("old-secret", "new-secret-1", "new-secret-1");

    expect(toast.error).toHaveBeenCalledWith("Could not change your password");
  });

  it("keeps the input after a wrong current password", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      error: { message: "Invalid password" },
    } as never);

    await submitPasswords("old-secret", "new-secret-1", "new-secret-1");

    expect(toast.error).toHaveBeenCalledWith("Invalid password");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current password")).toHaveValue("old-secret");
  });
});
