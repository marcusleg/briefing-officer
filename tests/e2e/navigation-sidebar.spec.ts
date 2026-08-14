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
  {
    linkText: "Filtered",
    expectedUrl: "/feed/filtered",
  },
].forEach(({ linkText, expectedUrl }) => {
  test(`navigation item ${linkText}`, async ({ page }) => {
    await page.goto("/feed");

    // Target the link rather than any text: "Filtered" also appears as the
    // dashboard chart's title, which would make a bare text locator ambiguous.
    await page.getByRole("link", { name: linkText }).click();

    await expect(page).toHaveURL(expectedUrl);

    await expect(page.locator("h2", { hasText: linkText })).toBeVisible();
  });
});
