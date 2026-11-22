import {
  changeArticleStatusForUser,
  CHAT_STATUS_TARGETS,
  getArticleForUser,
  MAX_STATUS_CHANGE_IDS,
  searchArticlesForUser,
} from "@/lib/ai/chat/articleTools";
import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";

const searchArticlesInput = z.object({
  terms: z
    .array(z.string().min(1))
    .min(1)
    .max(10)
    .describe(
      "Words, names, phrases, abbreviations or stock tickers to look for. Articles matching more terms rank higher, so include synonyms.",
    ),
  from: z.iso
    .date()
    .optional()
    .describe("Earliest publication date, YYYY-MM-DD, inclusive."),
  to: z.iso
    .date()
    .optional()
    .describe("Latest publication date, YYYY-MM-DD, inclusive."),
  sort: z
    .enum(["relevance", "newest", "oldest"])
    .default("relevance")
    .describe('"oldest" finds when something first appeared.'),
  status: z
    .enum(["UNREAD", "READ_LATER", "DISMISSED", "FILTERED"])
    .optional()
    .describe(
      "Only articles with this reading status, e.g. DISMISSED for articles the reader is done with.",
    ),
  archived: z
    .boolean()
    .optional()
    .describe("Only archived (true) or only unarchived (false) articles."),
  limit: z.number().int().min(1).max(25).default(10),
});
const setArticleStatusInput = z.object({
  ids: z
    .array(z.number().int())
    .min(1)
    .max(MAX_STATUS_CHANGE_IDS)
    .describe("Article ids from searchArticles or getArticle."),
  status: z
    .enum(CHAT_STATUS_TARGETS)
    .describe(
      "DISMISSED dismisses, UNREAD puts back in the inbox (also off Read later), READ_LATER saves for later.",
    ),
});

/**
 * The chat's tools, bound to one user. The model can choose what to search for
 * and which articles to change, but never whose: the user id is closed over
 * here. Changes run only after the reader approves them (see the route's
 * toolApproval).
 */
export const createChatTools = (userId: string) => ({
  searchArticles: tool({
    description:
      "Full-text search over the reader's articles (title, lead and article text). Returns the best matches with their lead, a snippet and a link path.",
    inputSchema: searchArticlesInput,
    execute: (input) => searchArticlesForUser(userId, input),
  }),
  getArticle: tool({
    description:
      "Returns one article's text by id: the scraped article text, or the feed's description when scraping failed. Use it when the lead and snippet from searchArticles are not enough.",
    inputSchema: z.object({
      id: z.number().int().describe("An article id from searchArticles."),
    }),
    execute: ({ id }) => getArticleForUser(userId, id),
  }),
  setArticleStatus: tool({
    description:
      "Changes the reading status of the reader's articles. The reader sees the articles and approves or declines before anything changes. Returns how many changed, how many already had that status and how many were not found.",
    inputSchema: setArticleStatusInput,
    execute: (input) => changeArticleStatusForUser(userId, input),
  }),
});

export type ChatTools = ReturnType<typeof createChatTools>;

export type ChatUIMessage = UIMessage<
  unknown,
  UIDataTypes,
  InferUITools<ChatTools>
>;
