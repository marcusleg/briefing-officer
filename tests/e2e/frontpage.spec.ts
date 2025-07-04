import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Briefing Officer/);
});

test("has logo that links to base url", async ({ page }) => {
  const logo = page.getByRole("link", { name: "Briefing Officer" });
  await expect(logo).toHaveAttribute("href", "/");
});

test("redirects to sign-in page if not authenticated", async ({ page }) => {
  await expect(page).toHaveURL("/sign-in");
});
