import { execSync } from "child_process";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long";
  process.env.BASE_URL = "http://localhost:3000";
});

import { auth } from "@/lib/auth";

describe("prisma seed", () => {
  it("creates a demo user who can sign in", async () => {
    // The seed reads DATABASE_URL, which vitest.setup.ts points at this
    // worker's throwaway database.
    execSync("npx tsx prisma/seed.ts", { env: process.env, stdio: "pipe" });

    const result = await auth.api.signInEmail({
      body: { email: "user@example.com", password: "password" },
    });

    expect(result.user.email).toBe("user@example.com");
  }, 60_000);
});
