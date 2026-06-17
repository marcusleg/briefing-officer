import prisma from "@/lib/prismaClient";
import {
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
} from "@/lib/repository/statsRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/repository/userRepository", () => ({
  getUserId: vi.fn(),
}));

let userId: string;
let feedId: number;

beforeEach(async () => {
  const user = await createUser();
  userId = user.id;
  vi.mocked(getUserId).mockResolvedValue(userId);
  feedId = (await createFeed({ userId, title: "Feed A" })).id;
});

describe("statsRepository counts", () => {
  it("counts unread articles (not read, not read-later)", async () => {
    await createArticle({ userId, feedId });
    await createArticle({ userId, feedId, readAt: new Date() });
    await createArticle({ userId, feedId, readLater: true });

    expect(await getNumberOfUnreadArticles()).toBe(1);
  });

  it("counts read-later articles", async () => {
    await createArticle({ userId, feedId, readLater: true });
    await createArticle({ userId, feedId });

    expect(await getNumberOfReadLaterArticles()).toBe(1);
  });

  it("reports unread counts per feed", async () => {
    await createArticle({ userId, feedId });
    await createArticle({ userId, feedId, readAt: new Date() });

    const perFeed = await getUnreadArticlesPerFeed();
    expect(perFeed).toEqual([{ feedTitle: "Feed A", unread: 1 }]);
  });

  it("reports token usage history by date and model", async () => {
    await prisma.tokenUsage.create({
      data: {
        userId,
        date: "2026-06-17",
        model: "test-model",
        inputTokens: 10,
        outputTokens: 5,
      },
    });

    await expect(
      getTokenUsageHistory(
        new Date("2026-06-17T00:00:00.000Z"),
        new Date("2026-06-17T23:59:59.999Z"),
      ),
    ).resolves.toEqual({
      rows: [
        {
          date: "2026-06-17",
          "test-model_input": 10,
          "test-model_output": 5,
        },
      ],
      models: ["test-model"],
    });
  });
});
