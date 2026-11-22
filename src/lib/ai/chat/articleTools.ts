import type { ArticleStatus, Prisma } from "@/generated/prisma/client";
import { setArticleStatusManyForUser } from "@/lib/articleStatus";
import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { searchDocuments, type SearchSort } from "@/lib/search/searchIndex";

/**
 * What the chat tools do, separate from their AI SDK definitions so it can be
 * tested directly. Every function takes the user id from the caller, never
 * from the model.
 */

/** Guards against outliers such as long PDFs; real articles are far shorter. */
export const ARTICLE_TEXT_LIMIT = 60_000;

// Status and archived filters run after the index lookup, so ask for plenty.
const CANDIDATES = 200;

export interface ArticleSummary {
  id: number;
  title: string;
  feed: string;
  /** `YYYY-MM-DD` */
  published: string;
  status: ArticleStatus;
  archived: boolean;
  lead: string | null;
  path: string;
}

export interface SearchArticlesInput {
  terms: string[];
  from?: string;
  to?: string;
  sort: SearchSort;
  status?: ArticleStatus;
  archived?: boolean;
  limit: number;
}

export type SearchArticlesOutput =
  { results: (ArticleSummary & { snippet: string })[] } | { error: string };

export type GetArticleOutput =
  | (ArticleSummary & { link: string; text: string; truncated: boolean })
  | { error: string };

export const articlePath = (article: { id: number; feedId: number }) =>
  `/feed/${article.feedId}/article/${article.id}/text-summary`;

const summaryInclude = {
  feed: { select: { title: true } },
  lead: true,
} as const;

type SummarizableArticle = Prisma.ArticleGetPayload<{
  include: typeof summaryInclude;
}>;

const summarize = (article: SummarizableArticle): ArticleSummary => ({
  id: article.id,
  title: article.title,
  feed: article.feed.title,
  published: article.publicationDate.toISOString().slice(0, 10),
  status: article.status,
  archived: article.archived,
  lead: article.lead?.text ?? null,
  path: articlePath(article),
});

export const searchArticlesForUser = async (
  userId: string,
  input: SearchArticlesInput,
): Promise<SearchArticlesOutput> => {
  let hits;
  try {
    hits = searchDocuments(userId, input.terms, {
      from: input.from,
      to: input.to,
      sort: input.sort,
      limit: CANDIDATES,
    });
  } catch (error) {
    logger.error({ err: error, userId }, "Article search failed.");
    return { error: "Search is unavailable right now." };
  }

  if (hits.length === 0) {
    return { results: [] };
  }

  // The index already filters by user; checking again here means a stale or
  // wrong index row can never leak an article, and rows for deleted articles
  // simply vanish.
  const articles = await prisma.article.findMany({
    where: {
      id: { in: hits.map((hit) => hit.articleId) },
      userId,
      status: input.status,
      archived: input.archived,
    },
    include: summaryInclude,
  });
  const byId = new Map(articles.map((article) => [article.id, article]));

  const results = hits
    .flatMap((hit) => {
      const article = byId.get(hit.articleId);
      return article ? [{ ...summarize(article), snippet: hit.snippet }] : [];
    })
    .slice(0, input.limit);

  return { results };
};

export const getArticleForUser = async (
  userId: string,
  id: number,
): Promise<GetArticleOutput> => {
  const article = await prisma.article.findFirst({
    where: { id, userId },
    include: { ...summaryInclude, scrape: true },
  });
  if (!article) {
    // Same answer for "someone else's" and "doesn't exist".
    return { error: "not found" };
  }

  const fullText = article.scrape?.textContent ?? article.description ?? "";
  const truncated = fullText.length > ARTICLE_TEXT_LIMIT;

  return {
    ...summarize(article),
    link: article.link,
    text: truncated ? fullText.slice(0, ARTICLE_TEXT_LIMIT) : fullText,
    truncated,
  };
};

/** The statuses the chat may set. Archiving and Not Interested stay manual. */
export const CHAT_STATUS_TARGETS = ["READ", "UNREAD", "READ_LATER"] as const;
export type ChatStatusTarget = (typeof CHAT_STATUS_TARGETS)[number];

/** Keeps one confirmation card readable. */
export const MAX_STATUS_CHANGE_IDS = 50;

export interface SetArticleStatusInput {
  ids: number[];
  status: ChatStatusTarget;
}

export type SetArticleStatusOutput =
  | {
      status: ChatStatusTarget;
      changed: number;
      alreadyInStatus: number;
      notFound: number;
    }
  | { error: string };

/**
 * Runs only after the reader approved the change in the chat. Articles that
 * already have the target status are left untouched so History keeps the
 * moment they were first read.
 */
export const changeArticleStatusForUser = async (
  userId: string,
  { ids, status }: SetArticleStatusInput,
): Promise<SetArticleStatusOutput> => {
  const unique = [...new Set(ids)];

  let changed: number;
  let found: number;
  try {
    const articles = await prisma.article.findMany({
      where: { id: { in: unique }, userId },
      select: { id: true, status: true },
    });
    found = articles.length;
    const toChange = articles
      .filter((article) => article.status !== status)
      .map((article) => article.id);

    // Nothing is revalidated: the /feed pages render per request, and the
    // chat page refreshes its own navigation.
    changed =
      toChange.length === 0
        ? 0
        : (
            await setArticleStatusManyForUser(
              userId,
              { id: { in: toChange }, status: { not: status } },
              status,
            )
          ).count;
  } catch (error) {
    logger.error({ err: error, userId }, "Chat status change failed.");
    return { error: "update failed" };
  }

  return {
    status,
    changed,
    alreadyInStatus: found - changed,
    notFound: unique.length - found,
  };
};
