import prisma from "@/lib/prismaClient";
import { describe, expect, it } from "vitest";

describe("integration harness", () => {
  it("starts each test with an empty users table", async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it("can write and read a user against the real test DB", async () => {
    await prisma.user.create({
      data: {
        id: "user-1",
        name: "Test",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    expect(await prisma.user.count()).toBe(1);
  });
});
