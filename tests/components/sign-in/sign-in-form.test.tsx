import SignInForm from "@/app/sign-in/sign-in-form";
import { authClient } from "@/lib/auth-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderForm = () =>
  render(
    <SignInForm
      isGenericOAuthEnabled
      genericOAuthProviderName="Authentik"
      callbackURL="/settings"
    />,
  );

describe("SignInForm", () => {
  it("returns to the callback URL after password sign-in", async () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push,
      refresh: vi.fn(),
      back: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: {},
    } as never);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings"));
  });

  it("passes the callback URL to single sign-on", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole("button", { name: "Login with Authentik" }),
    );

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "generic",
      callbackURL: "/settings",
    });
  });
});
