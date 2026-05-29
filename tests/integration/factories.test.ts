import prisma from "@/lib/prismaClient";
import { describe, expect, it } from "vitest";
import {
  createArticle,
  createCategory,
  createFeed,
  createUser,
} from "../helpers/factories";

describe("factories", () => {
  it("creates a user with sensible defaults", async () => {
    const user = await createUser();
    expect(user.id).toBeTruthy();
    expect(await prisma.user.count()).toBe(1);
  });

  it("creates a feed owned by a user", async () => {
    const user = await createUser();
    const feed = await createFeed({ userId: user.id, title: "My Feed" });
    expect(feed.title).toBe("My Feed");
    expect(feed.enabled).toBe(true);
  });

  it("creates an article on a feed", async () => {
    const user = await createUser();
    const feed = await createFeed({ userId: user.id });
    const article = await createArticle({ userId: user.id, feedId: feed.id });
    expect(article.feedId).toBe(feed.id);
  });

  it("creates a category", async () => {
    const user = await createUser();
    const category = await createCategory({ userId: user.id, name: "Tech" });
    expect(category.name).toBe("Tech");
  });
});
