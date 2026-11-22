import { isArticleId } from "@/lib/articleId";

/**
 * Where an article opens in the app. The chat's tools hand the model this
 * path and its answers cite articles by it; the chat UI then links each cited
 * article to its source instead.
 *
 * Runs in the browser too, so it imports no server code.
 */
export const articlePath = (article: { id: number; feedId: number }) =>
  `/feed/${article.feedId}/article/${article.id}/text-summary`;

// The model may add a trailing slash, a query or a fragment to the path.
const ARTICLE_PATH = /^\/feed\/\d+\/article\/(\d+)\/text-summary(?:[/?#].*)?$/;

/** The id of the article an `articlePath` points at, if `href` is one. */
export const articleIdFromPath = (href: string): number | undefined => {
  const match = ARTICLE_PATH.exec(href);
  const id = match ? Number(match[1]) : undefined;
  return isArticleId(id) ? id : undefined;
};

const CITED_PATH = /\/feed\/\d+\/article\/(\d+)\/text-summary/g;

/** The ids of the articles a chat answer's text cites. */
export const citedArticleIds = (text: string): number[] => [
  ...new Set(
    [...text.matchAll(CITED_PATH)]
      .map((match) => Number(match[1]))
      .filter(isArticleId),
  ),
];
