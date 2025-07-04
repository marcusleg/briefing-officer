import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { expect, test } from "@playwright/test";

// TODO use idiomatic way to handle auth in Playwright -> https://playwright.dev/docs/auth

test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");

  await Promise.all([
    prisma.account.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
});

test("does not have a navigation bar", async ({ page }) => {
  await expect(page.locator("nav")).toHaveCount(0);
});

test("has a link to the sign-up page", async ({ page }) => {
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/sign-up");
});

test.skip("redirects to frontpage when user is already authenticated", async ({
  page,
}) => {
  // TODO
});

test.describe("login form", () => {
  test("logs the user in when valid credentials are provided", async ({
    page,
  }) => {
    await auth.api.signUpEmail({
      body: {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      },
    });

    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
  });

  test("displays an error message when invalid credentials are provided", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("test@example.org");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    const errorToast = page.getByLabel("Notifications (F8)").locator("ol li");
    await expect(errorToast).toHaveCount(1);
    await expect(errorToast).toContainText("Sign In Error");
  });

  test("displays an error message when an empty form is submitted", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    const emailError = page.locator(
      "input[placeholder='Enter your email'] + p",
    );
    await expect(emailError).toBeVisible();
    await expect(emailError).toHaveText("Invalid email");

    const passwordError = page.locator(
      "input[placeholder='Enter your password'] + p",
    );
    await expect(passwordError).toBeVisible();
    await expect(passwordError).toHaveText("Password is required");
  });

  test("displays an error message when an invalid email is provided", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("test@example");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    const emailError = page.locator(
      "input[placeholder='Enter your email'] + p",
    );
    await expect(emailError).toBeVisible();
    await expect(emailError).toHaveText("Invalid email");
  });
});
