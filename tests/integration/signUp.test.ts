import prisma from "@/lib/prismaClient";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long";
  process.env.BASE_URL = "http://localhost:3000";
});

import { auth } from "@/lib/auth";

const signUp = (email: string, password = "password123") =>
  auth.api.signUpEmail({ body: { name: email, email, password } });

const userByEmail = (email: string) =>
  prisma.user.findUniqueOrThrow({ where: { email } });

describe("sign-up", () => {
  it("makes the first user an admin", async () => {
    await signUp("admin@example.com");

    const admin = await userByEmail("admin@example.com");
    expect(admin.role).toBe("admin");
    expect(admin.banned).not.toBe(true);
  });

  it("puts later sign-ups on hold for admin approval", async () => {
    await signUp("admin@example.com");
    await signUp("reader@example.com");

    expect((await userByEmail("reader@example.com")).banned).toBe(true);
  });

  it("does not lock out an existing user when someone signs up with their email", async () => {
    await signUp("admin@example.com");
    await signUp("reader@example.com");

    await signUp("admin@example.com", "attacker-password");

    const admin = await userByEmail("admin@example.com");
    expect(admin.banned).not.toBe(true);
    expect(admin.role).toBe("admin");
  });
});
