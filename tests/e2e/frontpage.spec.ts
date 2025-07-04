import { expect, test } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Briefing Officer/);
});

test("has logo that links to base url", async ({ page }) => {
  await page.goto("/");

  const logo = page.getByRole("link", { name: "Briefing Officer" });
  await expect(logo).toHaveAttribute("href", "/");
});
