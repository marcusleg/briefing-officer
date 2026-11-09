import SingleSignOn, { type SsoAccount } from "@/app/settings/single-sign-on";
import { authClient } from "@/lib/auth-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const ssoAccount: SsoAccount = {
  id: "acc-2",
  createdAt: new Date("2026-03-04T12:00:00Z"),
};

const renderSso = (
  props: {
    account?: SsoAccount;
    canDisconnect?: boolean;
    linkError?: string;
  } = {},
) =>
  render(
    <SingleSignOn
      account={props.account}
      canDisconnect={props.canDisconnect ?? true}
      providerName="Authentik"
      linkError={props.linkError}
    />,
  );

describe("SingleSignOn", () => {
  it("says when the account is not connected and offers to connect", () => {
    renderSso();

    expect(
      screen.getByText("Your account isn't connected to Authentik."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect Authentik" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Disconnect/ }),
    ).not.toBeInTheDocument();
  });

  it("connects the account", async () => {
    vi.mocked(authClient.linkSocial).mockResolvedValue({ data: {} } as never);
    const user = userEvent.setup();
    renderSso();

    await user.click(screen.getByRole("button", { name: "Connect Authentik" }));

    await waitFor(() =>
      expect(authClient.linkSocial).toHaveBeenCalledWith({
        provider: "generic",
        callbackURL: "/settings",
        errorCallbackURL: "/settings",
      }),
    );
  });

  it("says since when the account is connected", () => {
    renderSso({ account: ssoAccount });

    expect(
      screen.getByText(/Your account is connected to Authentik since/),
    ).toHaveTextContent("Mar 4, 2026");
    expect(
      screen.queryByRole("button", { name: /^Connect/ }),
    ).not.toBeInTheDocument();
  });

  it("disconnects the account", async () => {
    vi.mocked(authClient.unlinkAccount).mockResolvedValue({
      data: {},
    } as never);
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh } as never);
    const user = userEvent.setup();
    renderSso({ account: ssoAccount });

    await user.click(
      screen.getByRole("button", { name: "Disconnect Authentik" }),
    );

    await waitFor(() =>
      expect(authClient.unlinkAccount).toHaveBeenCalledWith({
        accountId: "acc-2",
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Authentik disconnected"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("explains why the only way to sign in can't be disconnected", () => {
    renderSso({ account: ssoAccount, canDisconnect: false });

    expect(
      screen.getByRole("button", { name: "Disconnect Authentik" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "You can't disconnect it because you have no password to sign in with.",
      ),
    ).toBeInTheDocument();
  });

  it("asks for a fresh sign-in", async () => {
    vi.mocked(authClient.unlinkAccount).mockResolvedValue({
      error: { code: "SESSION_NOT_FRESH", message: "Session is not fresh" },
    } as never);
    const user = userEvent.setup();
    renderSso({ account: ssoAccount });

    await user.click(
      screen.getByRole("button", { name: "Disconnect Authentik" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "For your security, sign out and sign in again before disconnecting.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a link error as text", () => {
    const message = "<b>email_doesn't_match</b>";
    const { container } = renderSso({ linkError: message });

    expect(screen.getByRole("alert").textContent).toContain(message);
    expect(container.querySelector("b")).toBeNull();
  });
});
