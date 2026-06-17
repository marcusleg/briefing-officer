import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      DATABASE_URL: "file:../data/database.sqlite",
    },
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
