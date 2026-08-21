import prisma from "@/lib/prismaClient";
import {
  getFilteredArticlesPerDay,
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
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

  it("counts new articles per feed by their publication date", async () => {
    const otherFeedId = (await createFeed({ userId, title: "Feed B" })).id;
    await createArticle({
      userId,
      feedId,
      publicationDate: new Date("2026-02-10T06:00:00.000Z"),
    });
    await createArticle({
      userId,
      feedId: otherFeedId,
      publicationDate: new Date("2026-02-10T22:00:00.000Z"),
    });
    await createArticle({
      userId,
      feedId,
      publicationDate: new Date("2026-02-12T06:00:00.000Z"),
    });

    const { rows, feedKeys, dailyAverage } = await getWeeklyArticleCountPerFeed(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-12T00:00:00.000Z"),
    );

    expect(rows).toEqual([
      { date: "2026-02-10", "Feed A": 1, "Feed B": 1 },
      { date: "2026-02-11" },
      { date: "2026-02-12", "Feed A": 1 },
    ]);
    expect(new Set(feedKeys)).toEqual(new Set(["Feed A", "Feed B"]));
    expect(dailyAverage).toBe(1);
  });

  it("leaves articles published outside the range out of the new-article counts", async () => {
    await createArticle({
      userId,
      feedId,
      publicationDate: new Date("2026-02-09T23:59:59.000Z"),
    });
    await createArticle({
      userId,
      feedId,
      publicationDate: new Date("2026-02-11T00:00:00.000Z"),
    });

    const { rows } = await getWeeklyArticleCountPerFeed(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10" }]);
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

    expect(rows).toEqual([{ date: "2026-02-10", "Feed A": 1 }]);
  });

  it("splits the read articles of a day across their feeds", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    const otherFeedId = (await createFeed({ userId, title: "Feed B" })).id;
    await createArticle({
      userId,
      feedId,
      status: "READ",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId: otherFeedId,
      status: "READ",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId: otherFeedId,
      status: "READ",
      statusChangedAt: day,
    });

    const { rows, feedKeys, dailyAverage } = await getWeeklyArticlesRead(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10", "Feed A": 1, "Feed B": 2 }]);
    expect(new Set(feedKeys)).toEqual(new Set(["Feed A", "Feed B"]));
    expect(dailyAverage).toBe(3);
  });

  it("does not count another user's read articles", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    const otherUser = await createUser();
    const otherFeed = await createFeed({ userId: otherUser.id });
    await createArticle({
      userId: otherUser.id,
      feedId: otherFeed.id,
      status: "READ",
      statusChangedAt: day,
    });

    const { rows, feedKeys } = await getWeeklyArticlesRead(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10" }]);
    expect(feedKeys).toEqual([]);
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

    expect(rows).toEqual([{ date: "2026-02-10", "Feed A": 3 }]);
    expect(dailyAverage).toBe(3);
  });

  it("splits the rejected articles of a day across their feeds", async () => {
    const day = new Date("2026-02-10T12:00:00.000Z");
    const otherFeedId = (await createFeed({ userId, title: "Feed B" })).id;
    await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      statusChangedAt: day,
    });
    await createArticle({
      userId,
      feedId: otherFeedId,
      status: "FILTERED",
      statusChangedAt: day,
    });

    const { rows, feedKeys } = await getFilteredArticlesPerDay(
      new Date("2026-02-10T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(rows).toEqual([{ date: "2026-02-10", "Feed A": 1, "Feed B": 1 }]);
    expect(new Set(feedKeys)).toEqual(new Set(["Feed A", "Feed B"]));
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

    expect(rows).toEqual([{ date: "2026-02-10" }]);
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
      { date: "2026-02-10", "Feed A": 1 },
      { date: "2026-02-11" },
      { date: "2026-02-12", "Feed A": 1 },
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

    expect(rows).toEqual([{ date: "2026-02-10" }]);
  });

  it("returns an empty chart when the range covers no days", async () => {
    await createArticle({
      userId,
      feedId,
      publicationDate: new Date("2026-02-10T06:00:00.000Z"),
    });

    const invalid = new Date("not a date");
    const empty = { rows: [], feedKeys: [], dailyAverage: 0 };

    await expect(
      getWeeklyArticleCountPerFeed(invalid, invalid),
    ).resolves.toEqual(empty);
    await expect(getWeeklyArticlesRead(invalid, invalid)).resolves.toEqual(
      empty,
    );
    await expect(getFilteredArticlesPerDay(invalid, invalid)).resolves.toEqual(
      empty,
    );
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
