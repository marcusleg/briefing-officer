import { trackTokenUsage } from "@/lib/ai/services/tokenUsageService";
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../helpers/factories";

let userId: string;

beforeEach(async () => {
  userId = (await createUser()).id;
});

describe("trackTokenUsage", () => {
  it("creates a usage row on first call", async () => {
    await trackTokenUsage(userId, "test-model", 10, 5);

    const rows = await prisma.tokenUsage.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].inputTokens).toBe(10);
    expect(rows[0].outputTokens).toBe(5);
    expect(rows[0]).not.toHaveProperty("reasoningTokens");
  });

  it("accumulates tokens for the same user/date/model", async () => {
    await trackTokenUsage(userId, "test-model", 10, 5);
    await trackTokenUsage(userId, "test-model", 3, 2);

    const row = await prisma.tokenUsage.findFirstOrThrow({ where: { userId } });
    expect(row.inputTokens).toBe(13);
    expect(row.outputTokens).toBe(7);
    expect(row).not.toHaveProperty("reasoningTokens");
  });
});
