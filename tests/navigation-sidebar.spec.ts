import { faker } from "@faker-js/faker";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/feed");
});

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
  test(`clicking ${linkText} navigates to correct page`, async ({ page }) => {
    await page.getByRole("navigation").getByText(linkText).click();

    await expect(page).toHaveURL(expectedUrl);

    await expect(
      page.getByRole("main").getByRole("heading", { name: linkText }),
    ).toBeVisible();
  });
});

test("journey: add new feed category", async ({ page }) => {
  const categoryName = faker.lorem.word();

  await page.getByText("Add Category").click();

  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Add a new category" }),
  ).toBeVisible();

  await page.getByLabel("Name").fill(categoryName);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(
    page.getByRole("navigation").getByText(categoryName),
  ).toBeVisible();
});

test("journey: add new feed without category or filter expressions", async ({
  page,
}) => {
  const feedTitle = faker.lorem.words({ min: 1, max: 3 });

  await page.locator("id=left-navigation").getByText("Add Feed").click();

  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Add a new feed" }),
  ).toBeVisible();

  await page.getByLabel("Title", { exact: true }).fill(feedTitle);
  await page
    .getByLabel("Feed URL")
    .fill("https://lorem-rss.herokuapp.com/feed?length=1");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(
    page.locator("id=left-navigation").getByText(feedTitle),
  ).toBeVisible();
});
