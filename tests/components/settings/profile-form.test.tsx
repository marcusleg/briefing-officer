import ProfileForm from "@/app/settings/profile-form";
import { authClient } from "@/lib/auth-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    updateUser: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const submitName = async (value: string) => {
  const user = userEvent.setup();
  render(<ProfileForm name="Ada" email="ada@example.com" />);
  const input = screen.getByLabelText("Name");
  await user.clear(input);
  await user.type(input, value);
  await user.click(screen.getByRole("button", { name: "Save" }));
};

describe("ProfileForm", () => {
  it("shows the email address read-only", () => {
    render(<ProfileForm name="Ada" email="ada@example.com" />);

    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("ada@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(
      screen.getByText("Your email address can't be changed."),
    ).toBeInTheDocument();
  });

  it("saves a trimmed new name", async () => {
    vi.mocked(authClient.updateUser).mockResolvedValue({ data: {} } as never);

    await submitName("  Ada Lovelace  ");

    expect(authClient.updateUser).toHaveBeenCalledWith({
      name: "Ada Lovelace",
    });
    expect(toast.success).toHaveBeenCalledWith("Name updated");
  });

  it("rejects a blank name", async () => {
    await submitName("   ");

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(authClient.updateUser).not.toHaveBeenCalled();
  });

  it("does not save an unchanged name", async () => {
    await submitName("Ada");

    expect(
      await screen.findByText("That's already your name"),
    ).toBeInTheDocument();
    expect(authClient.updateUser).not.toHaveBeenCalled();
  });

  it("shows the server error", async () => {
    vi.mocked(authClient.updateUser).mockResolvedValue({
      error: { message: "Boom" },
    } as never);

    await submitName("Grace");

    expect(toast.error).toHaveBeenCalledWith("Boom");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
