import prisma from "@/lib/prismaClient";
import {
  getFilteredArticlesPerDay,
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticlesRead,
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
    await createArticle({ userId, feedId, status: "READ" });
    await createArticle({ userId, feedId, status: "READ_LATER" });

    expect(await getNumberOfUnreadArticles()).toBe(1);
  });

  it("counts read-later articles", async () => {
    await createArticle({ userId, feedId, status: "READ_LATER" });
    await createArticle({ userId, feedId });

    expect(await getNumberOfReadLaterArticles()).toBe(1);
  });

  it("does not count read-later articles as unread per feed", async () => {
    await createArticle({ userId, feedId });
    await createArticle({ userId, feedId, status: "READ" });
    await createArticle({ userId, feedId, status: "READ_LATER" });

    const perFeed = await getUnreadArticlesPerFeed();
    expect(perFeed).toEqual([{ feedTitle: "Feed A", unread: 1 }]);
  });

  it("counts read articles but not hand-rejected ones as read that day", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: day,
    });

    const { rows } = await getWeeklyArticlesRead(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10", count: 1 }]);
  });

  it("counts every rejected article for the day", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: day,
    });

    const { rows, dailyAverage } = await getFilteredArticlesPerDay(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10", filtered: 3 }]);
    expect(dailyAverage).toBe(3);
  });

  it("leaves unread and read articles out of the rejected counts", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    await createArticle({ userId, feedId, statusChangedAt: day });
    await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId,
      status: "READ_LATER",
      statusChangedAt: day,
    });

    const { rows, dailyAverage } = await getFilteredArticlesPerDay(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10", filtered: 0 }]);
    expect(dailyAverage).toBe(0);
  });

  it("averages the total across every day in the range", async () => {
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: new Date("2026-02-10T12:00:00.000Z"),
    });
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: new Date("2026-02-12T12:00:00.000Z"),
    });

    const { rows, dailyAverage } = await getFilteredArticlesPerDay(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-12T00:00:00.000Z"),
    );

    expect(rows).toEqual([
      { date: "2026-02-10", filtered: 1 },
      { date: "2026-02-11", filtered: 0 },
      { date: "2026-02-12", filtered: 1 },
    ]);
    expect(dailyAverage).toBeCloseTo(2 / 3);
  });

  it("does not count another user's rejected articles", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    const otherUser = await createUser();
    const otherFeed = await createFeed({ userId: otherUser.id });
    await createArticle({
      userId: otherUser.id,
      feedId: otherFeed.id,
      status: "FILTERED",
      statusChangedAt: day,
    });

    const { rows } = await getFilteredArticlesPerDay(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10", filtered: 0 }]);
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
