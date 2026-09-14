import UserDropdownMenu from "@/components/navigation/user-dropdown-menu";
import { SidebarProvider } from "@/components/ui/sidebar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("@/lib/repository/opmlRepository", () => ({
  importOpml: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const openMenu = async () => {
  const user = userEvent.setup();
  render(
    <SidebarProvider>
      <UserDropdownMenu userName="Demo User" />
    </SidebarProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Demo User" }));
  return user;
};

describe("UserDropdownMenu", () => {
  it("lists the OPML actions above Sign out", async () => {
    await openMenu();

    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Import OPML",
      "Export OPML",
      "Sign out",
    ]);
  });

  it("exports through a download link to the OPML route", async () => {
    await openMenu();

    const exportItem = screen.getByRole("menuitem", { name: "Export OPML" });
    expect(exportItem).toHaveAttribute("href", "/api/opml");
    expect(exportItem).toHaveAttribute("download", "briefing-officer.opml");
  });

  it("opens the import dialog and closes the menu", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Import OPML" }));

    expect(
      await screen.findByRole("dialog", { name: "Import OPML" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps working after the import dialog was dismissed", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Import OPML" }));
    await screen.findByRole("dialog", { name: "Import OPML" });
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Import OPML" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Demo User" }));
    await user.click(screen.getByRole("menuitem", { name: "Import OPML" }));

    expect(
      await screen.findByRole("dialog", { name: "Import OPML" }),
    ).toBeInTheDocument();
  });
});
