import { request, test } from "@playwright/test";
import path from "path";

const SCREENSHOTS_DIR = path.resolve(__dirname, "../docs/screenshots");
const BASE_URL = "http://localhost:3000";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1080 },
] as const;

const THEMES = ["light", "dark"] as const;

test("capture screenshots", async ({ browser }) => {
  // Authenticate and save storage state
  const apiContext = await request.newContext({ baseURL: BASE_URL });
  const signInResponse = await apiContext.post("/api/auth/sign-in/email", {
    data: { email: "user@example.com", password: "password" },
  });
  if (!signInResponse.ok()) {
    throw new Error(
      `Sign-in failed: ${signInResponse.status()} — is the DB seeded?`,
    );
  }
  const storageState = await apiContext.storageState();
  await apiContext.dispose();

  // Capture one screenshot per viewport × theme combination
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        storageState,
        viewport: { width: viewport.width, height: viewport.height },
      });

      // Set theme in localStorage before page load so next-themes applies it at hydration
      await context.addInitScript((themeValue) => {
        localStorage.setItem("theme", themeValue);
      }, theme);

      const page = await context.newPage();

      await page.goto("/feed");
      await page.waitForLoadState("networkidle");

      // Hide the Next.js dev-mode overlay icon
      await page.evaluate(() => {
        const portal = document.querySelector("nextjs-portal");
        if (portal) (portal as HTMLElement).style.display = "none";
      });

      const filename = `${viewport.name}-${theme}.png`;
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, filename),
        fullPage: false,
      });

      await context.close();
      console.log(`Saved: docs/screenshots/${filename}`);
    }
  }
});
