import { collectGaugeMetrics } from "@/lib/metricsRepository";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db";
import { createArticle, createFeed, createUser } from "../helpers/factories";

beforeEach(async () => {
  await resetDb();
});

describe("metricsRepository", () => {
  it("collects gauge metrics for users, feeds, and duplicate feed names", async () => {
    const user = await createUser();
    const firstFeed = await createFeed({ userId: user.id, title: "Tech Feed" });
    const secondFeed = await createFeed({
      userId: user.id,
      title: "Tech Feed",
    });

    await createArticle({
      userId: user.id,
      feedId: firstFeed.id,
    });
    await createArticle({
      userId: user.id,
      feedId: firstFeed.id,
      readLater: true,
    });
    await createArticle({
      userId: user.id,
      feedId: secondFeed.id,
      readAt: new Date(),
    });
    await createArticle({
      userId: user.id,
      feedId: secondFeed.id,
      starred: true,
    });

    await expect(collectGaugeMetrics()).resolves.toEqual({
      usersTotal: 1,
      feeds: [{ userId: user.id, count: 2 }],
      articles: [
        {
          userId: user.id,
          feedName: "Tech Feed",
          total: 4,
          unread: 3,
          readLater: 1,
          starred: 1,
        },
      ],
    });
  });

  it("includes zero-valued article rows for empty feeds", async () => {
    const user = await createUser();
    await createFeed({ userId: user.id, title: "Empty Feed" });

    await expect(collectGaugeMetrics()).resolves.toEqual({
      usersTotal: 1,
      feeds: [{ userId: user.id, count: 1 }],
      articles: [
        {
          userId: user.id,
          feedName: "Empty Feed",
          total: 0,
          unread: 0,
          readLater: 0,
          starred: 0,
        },
      ],
    });
  });
});
