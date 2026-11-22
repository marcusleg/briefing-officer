import {
  setArticleStatusForUser,
  setArticleStatusManyForUser,
} from "@/lib/articleStatus";
import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

const longAgo = new Date("2020-01-01T00:00:00Z");

let userId: string;
let feedId: number;
let otherUserId: string;
let otherFeedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
  otherUserId = (await createUser()).id;
  otherFeedId = (await createFeed({ userId: otherUserId })).id;
});

const reload = (id: number) =>
  prisma.article.findUniqueOrThrow({ where: { id } });

describe("setArticleStatusForUser", () => {
  it("writes the status together with statusChangedAt", async () => {
    const article = await createArticle({
      userId,
      feedId,
      statusChangedAt: longAgo,
    });

    await setArticleStatusForUser(userId, article.id, "DISMISSED");

    const updated = await reload(article.id);
    expect(updated.status).toBe("DISMISSED");
    expect(updated.statusChangedAt.getTime()).toBeGreaterThan(
      longAgo.getTime(),
    );
  });

  it("writes filterReason only when given", async () => {
    const article = await createArticle({
      userId,
      feedId,
      status: "FILTERED",
      filterReason: "Off topic.",
    });

    await setArticleStatusForUser(userId, article.id, "UNREAD");
    expect((await reload(article.id)).filterReason).toBe("Off topic.");

    await setArticleStatusForUser(userId, article.id, "FILTERED", "Nope.");
    expect((await reload(article.id)).filterReason).toBe("Nope.");
  });

  it("refuses another user's article and leaves it alone", async () => {
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
    });

    await expect(
      setArticleStatusForUser(userId, foreign.id, "DISMISSED"),
    ).rejects.toThrow();
    expect((await reload(foreign.id)).status).toBe("UNREAD");
  });
});

describe("setArticleStatusManyForUser", () => {
  it("changes only the user's matching articles and stamps them", async () => {
    const own = await createArticle({
      userId,
      feedId,
      statusChangedAt: longAgo,
    });
    const foreign = await createArticle({
      userId: otherUserId,
      feedId: otherFeedId,
    });

    const { count } = await setArticleStatusManyForUser(
      userId,
      // A caller naming another user's id must still not reach their rows.
      { id: { in: [own.id, foreign.id] }, userId: otherUserId },
      "READ_LATER",
    );

    expect(count).toBe(1);
    const updated = await reload(own.id);
    expect(updated.status).toBe("READ_LATER");
    expect(updated.statusChangedAt.getTime()).toBeGreaterThan(
      longAgo.getTime(),
    );
    expect((await reload(foreign.id)).status).toBe("UNREAD");
  });
});
