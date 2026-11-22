import prisma from "@/lib/prismaClient";
import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArticle, createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
// The article actions import services that load a model at import.
vi.mock("@/lib/ai/registry", () => ({
  getFirstConfiguredLanguageModel: vi.fn().mockResolvedValue({}),
}));

import TextSummary from "@/app/feed/[feedId]/article/[articleId]/text-summary/page";
import Chat from "@/components/chat/chat";
import { auth } from "@/lib/auth";

/** Every element in a rendered tree, without rendering client components. */
const elements = (node: ReactNode): React.ReactElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap(elements);
  }
  if (!isValidElement<{ children?: ReactNode; header?: ReactNode }>(node)) {
    return [];
  }
  return [
    node,
    ...elements(node.props.children),
    ...elements(node.props.header),
  ];
};

const text = (node: ReactNode): string =>
  elements(node)
    .flatMap((element) => {
      const children = (element.props as { children?: ReactNode }).children;
      return [children].flat().filter((child) => typeof child === "string");
    })
    .join(" ");

let userId: string;
let feedId: number;

beforeEach(async () => {
  userId = (await createUser()).id;
  feedId = (await createFeed({ userId })).id;
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId },
  } as never);
});

const open = async (articleId: number) =>
  TextSummary({
    params: Promise.resolve({
      feedId: String(feedId),
      articleId: String(articleId),
    }),
  });

describe("text summary page", () => {
  it("opens the chat on an article with article text", async () => {
    const article = await createArticle({ userId, feedId });
    await prisma.articleScrape.create({
      data: { articleId: article.id, textContent: "Full text.", author: "" },
    });

    const page = await open(article.id);

    const chat = elements(page).find((element) => element.type === Chat);
    expect(chat?.props).toMatchObject({ article: { id: article.id } });
    expect(text(page)).not.toContain("Text summary unavailable");
  });

  it("explains instead of opening a chat when there is no article text", async () => {
    const article = await createArticle({ userId, feedId });

    const page = await open(article.id);

    expect(elements(page).some((element) => element.type === Chat)).toBe(false);
    expect(text(page)).toContain("Text summary unavailable");
  });
});
