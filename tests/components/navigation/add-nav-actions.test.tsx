import AddNavActions from "@/components/navigation/add-nav-actions";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The dialogs behind both rows import server actions from the feed repository,
// which would otherwise pull Prisma into jsdom.
vi.mock("@/lib/repository/feedRepository", () => ({
  createCategory: vi.fn(),
  createFeed: vi.fn(),
  getFeedFilters: vi.fn(),
  getUserCategories: vi.fn(),
  updateCategory: vi.fn(),
  updateFeed: vi.fn(),
}));

describe("AddNavActions", () => {
  it("offers only the two everyday actions", () => {
    render(
      <SidebarProvider>
        <SidebarMenu>
          <AddNavActions />
        </SidebarMenu>
      </SidebarProvider>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Add Category",
      "Add Feed",
    ]);
    expect(screen.queryByText(/OPML/)).not.toBeInTheDocument();
  });
});
