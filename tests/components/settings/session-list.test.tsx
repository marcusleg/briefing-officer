import SessionList, { type SessionSummary } from "@/app/settings/session-list";
import { authClient } from "@/lib/auth-client";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { renderToString } from "react-dom/server";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    revokeSession: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const current: SessionSummary = {
  id: "s1",
  token: "t1",
  device: { label: "Firefox on Linux", isMobile: false },
  createdAt: new Date(2026, 10, 9),
  updatedAt: new Date(2026, 10, 9, 10, 0),
  expiresAt: new Date(2026, 10, 16),
};
const phone: SessionSummary = {
  id: "s2",
  token: "t2",
  device: { label: "Safari on iOS", isMobile: true },
  createdAt: new Date(2026, 10, 1),
  updatedAt: new Date(2026, 10, 8),
  expiresAt: new Date(2026, 10, 15),
};
const old: SessionSummary = {
  id: "s3",
  token: "t3",
  device: { label: "Unknown device", isMobile: false },
  createdAt: new Date(2026, 9, 28),
  updatedAt: new Date(2026, 10, 4),
  expiresAt: new Date(2026, 10, 11),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const row = (label: string) =>
  screen.getByText(label).closest("li") as HTMLElement;

describe("SessionList", () => {
  it("lists the current session first, then by last active", () => {
    render(
      <SessionList sessions={[old, phone, current]} currentSessionId="s1" />,
    );

    const labels = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");
    expect(labels[0]).toContain("Firefox on Linux");
    expect(labels[1]).toContain("Safari on iOS");
    expect(labels[2]).toContain("Unknown device");
  });

  it("marks only the current session", () => {
    render(
      <SessionList sessions={[old, phone, current]} currentSessionId="s1" />,
    );

    const pills = screen.getAllByText("This device");
    expect(pills).toHaveLength(1);
    expect(row("Firefox on Linux")).toContainElement(pills[0]);
  });

  it("shows when each session signed in, was last active and expires", () => {
    render(
      <SessionList sessions={[old, phone, current]} currentSessionId="s1" />,
    );

    const currentRow = row("Firefox on Linux");
    expect(currentRow).toHaveTextContent("Signed in Nov 9, 2026");
    expect(currentRow).toHaveTextContent("Last active today");
    expect(currentRow).toHaveTextContent("Expires Nov 16, 2026");
    expect(row("Safari on iOS")).toHaveTextContent("Last active yesterday");
    expect(row("Unknown device")).toHaveTextContent("Last active Nov 4, 2026");
  });

  it("does not render dates on the server", () => {
    const html = renderToString(
      <SessionList sessions={[current]} currentSessionId="s1" />,
    );

    expect(html).not.toContain("Nov 16, 2026");
    expect(html).toContain("Firefox on Linux");
  });

  it("signs out another session", async () => {
    vi.mocked(authClient.revokeSession).mockResolvedValue({
      data: {},
    } as never);
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh } as never);
    const user = userEvent.setup();
    render(<SessionList sessions={[current, phone]} currentSessionId="s1" />);

    await user.click(
      within(row("Safari on iOS")).getByRole("button", { name: /Sign out/ }),
    );

    await waitFor(() =>
      expect(authClient.revokeSession).toHaveBeenCalledWith({ token: "t2" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Session signed out"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("disables a row's button while its sign-out is pending", async () => {
    vi.mocked(authClient.revokeSession).mockReturnValue(
      new Promise(() => {}) as never,
    );
    const user = userEvent.setup();
    render(<SessionList sessions={[current, phone]} currentSessionId="s1" />);
    const button = within(row("Safari on iOS")).getByRole("button", {
      name: /Sign out/,
    });

    await user.click(button);
    await user.click(button);

    expect(authClient.revokeSession).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(
      within(row("Firefox on Linux")).getByRole("button", { name: /Sign out/ }),
    ).toBeDisabled();
  });

  it("names this device's sign-out button distinctly", () => {
    const sameLabel = {
      ...phone,
      id: "s4",
      token: "t4",
      device: current.device,
    };
    render(
      <SessionList sessions={[current, sameLabel]} currentSessionId="s1" />,
    );

    expect(
      screen.getByRole("button", {
        name: "Sign out Firefox on Linux (this device)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out Firefox on Linux" }),
    ).toBeInTheDocument();
  });

  it("always shows the current session as last active today", () => {
    const stale = { ...current, updatedAt: new Date(2026, 10, 8, 23, 0) };
    render(<SessionList sessions={[stale]} currentSessionId="s1" />);

    expect(row("Firefox on Linux")).toHaveTextContent("Last active today");
  });

  it("shows an error when signing out fails", async () => {
    vi.mocked(authClient.revokeSession).mockResolvedValue({
      error: { message: "Nope" },
    } as never);
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh } as never);
    const user = userEvent.setup();
    render(<SessionList sessions={[current, phone]} currentSessionId="s1" />);

    await user.click(
      within(row("Safari on iOS")).getByRole("button", { name: /Sign out/ }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error when signing out throws", async () => {
    vi.mocked(authClient.revokeSession).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<SessionList sessions={[current, phone]} currentSessionId="s1" />);
    const button = within(row("Safari on iOS")).getByRole("button", {
      name: /Sign out/,
    });

    await user.click(button);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not sign out the session",
      ),
    );
    expect(button).toBeEnabled();
  });

  it("signs out of this device", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: {} } as never);
    const push = vi.fn();
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push, refresh } as never);
    const user = userEvent.setup();
    render(<SessionList sessions={[current, phone]} currentSessionId="s1" />);

    await user.click(
      screen.getByRole("button", {
        name: "Sign out Firefox on Linux (this device)",
      }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-in"));
    expect(authClient.signOut).toHaveBeenCalled();
    expect(authClient.revokeSession).not.toHaveBeenCalled();
  });

  it("says when there are no sessions", () => {
    render(<SessionList sessions={[]} currentSessionId="s1" />);

    expect(screen.getByText("No sessions to show.")).toBeInTheDocument();
  });
});
