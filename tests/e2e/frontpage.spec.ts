import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Briefing Officer/);
});

test("redirects to sign-in page if not authenticated", async ({ page }) => {
  await expect(page).toHaveURL("/sign-in");
});
