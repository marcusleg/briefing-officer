import {
  getArticleForUser,
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
    .enum(["UNREAD", "READ_LATER", "READ", "FILTERED"])
    .optional()
    .describe(
      "Only articles with this reading status, e.g. READ for articles the reader has read.",
    ),
  starred: z
    .boolean()
    .optional()
    .describe("Only starred (true) or only unstarred (false) articles."),
  limit: z.number().int().min(1).max(25).default(10),
});

/**
 * The chat's tools, bound to one user. The model can choose what to search
 * for but never whose articles: the user id is closed over here.
 */
export const createChatTools = (userId: string) => ({
  searchArticles: tool({
    description:
      "Full-text search over the reader's articles (title, summary and article text). Returns the best matches with their lead, a snippet and a link path.",
    inputSchema: searchArticlesInput,
    execute: (input) => searchArticlesForUser(userId, input),
  }),
  getArticle: tool({
    description:
      "Returns one article's full text by id. Use it when the lead and snippet from searchArticles are not enough.",
    inputSchema: z.object({
      id: z.number().int().describe("An article id from searchArticles."),
    }),
    execute: ({ id }) => getArticleForUser(userId, id),
  }),
});

export type ChatTools = ReturnType<typeof createChatTools>;

export type ChatUIMessage = UIMessage<
  unknown,
  UIDataTypes,
  InferUITools<ChatTools>
>;
