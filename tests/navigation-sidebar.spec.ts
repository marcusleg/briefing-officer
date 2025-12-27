import { expect, test } from "./fixtures";
[
  {
    linkText: "Read Later",
    expectedUrl: "/feed/read-later",
  },
  {
    linkText: "History",
    expectedUrl: "/feed/history",
  },
  {
    linkText: "Starred",
    expectedUrl: "/feed/starred-articles",
  },
].forEach(({ linkText, expectedUrl }) => {
  test(`navigation item ${linkText}`, async ({ page }) => {
    await page.goto("/feed");

    await page.getByText(linkText).click();

    await expect(page).toHaveURL(expectedUrl);

    await expect(page.locator("h2", { hasText: linkText })).toBeVisible();
  });
});
