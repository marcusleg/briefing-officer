import prisma from "@/lib/prismaClient";
import { beforeEach, describe, expect, it } from "vitest";
import { createFeed, createFeedFilter, createUser } from "../helpers/factories";

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
});

describe("FeedFilter", () => {
  it("rejects a duplicate entry for the same feed and kind", async () => {
    await createFeedFilter({ feedId, kind: "DISINTEREST", text: "crypto" });

    await expect(
      createFeedFilter({ feedId, kind: "DISINTEREST", text: "crypto" }),
    ).rejects.toThrow();
  });

  it("allows the same text in both lists", async () => {
    await createFeedFilter({ feedId, kind: "DISINTEREST", text: "politics" });

    await expect(
      createFeedFilter({ feedId, kind: "INTEREST", text: "politics" }),
    ).resolves.toBeTruthy();
  });

  it("deletes a feed's filters along with the feed", async () => {
    await createFeedFilter({ feedId, kind: "INTEREST", text: "kernel" });

    await prisma.feed.delete({ where: { id: feedId } });

    expect(await prisma.feedFilter.count({ where: { feedId } })).toBe(0);
  });
});
