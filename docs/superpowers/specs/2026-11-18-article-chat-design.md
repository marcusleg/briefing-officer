# Article Chat

## Intent

Readers can only find past articles with the search box, which matches a literal
substring in titles and bodies. They want to ask questions about what their
feeds have covered, in plain language, for example:

- What was in the news regarding the Alphabet stock this year?
- I read an article about creating presentations that made a point about
  defining the target audiences. Find it for me!
- List the classifier models similar to X that appeared after X made the news.

This feature adds a chat page where an LLM answers such questions by searching
the reader's own articles and citing them.

## Goals

- A chat page at `/chat`, linked from the left navigation.
- Answers draw **only** on articles stored in Briefing Officer for the signed-in
  user, and every claim links to the article it came from.
- Ranked full-text search over title, lead and article body, with date, status
  and starred filters, that the LLM can call several times per question.
- Works with every supported AI provider (Anthropic, Azure OpenAI, OpenAI and
  OpenAI-compatible APIs) without new configuration.
- No Prisma schema change.

## Non-goals

- Saved conversation history. A conversation lives in the browser tab and is
  gone on reload. Saved, listed conversations may follow later as their own
  feature; nothing here should make that harder.
- Web search or any knowledge outside the reader's articles.
- Semantic (embedding) search. The search tool's interface is designed so a
  semantic mode can be added behind it later without changing the chat.
- Per-user rate limits or token budgets. Chat usage appears in the existing
  token usage statistics like every other generation.
- Replacing the existing search box.

## Anti-goals

- Answers drawn from another user's articles.
- Tools that change anything. The LLM can read articles, never star, mark,
  delete or fetch. Article text is untrusted input; with read-only tools the
  worst a hostile article can do is skew one answer.
- Confident answers without sources. When nothing relevant is found, the answer
  says so.

## Constraints

- Next.js 16.4 (APIs differ from older versions; read
  `node_modules/next/dist/docs/` before writing route handlers), React 19, AI
  SDK 7 (`ai`, `@ai-sdk/react`), Prisma 7 on SQLite via `better-sqlite3`.
- Prisma treats FTS5 shadow tables as drift: `prisma migrate diff` against a
  database containing an FTS5 table proposes dropping `<table>_data`, `_idx`,
  `_docsize` and `_config`. The index therefore lives in a separate SQLite file
  that Prisma never opens.
- The model comes from `getFirstConfiguredLanguageModel()`
  (`src/lib/ai/registry.ts`); usage is recorded with `trackTokenUsage`
  (`src/lib/ai/services/tokenUsageService.ts`).
- `src/proxy.ts` only guards the paths in its matcher; `/chat` must be added.
- Design rules from `AGENTS.md`: color only through tokens, flat surfaces,
  answer text uses `text-prose` within `max-w-content`.

## Design

### Overview

```
/chat page ──useChat──▶ POST /api/chat ──streamText + tools──▶ LLM
                              │
                              ├─ searchArticles ─▶ search index (FTS5 file)
                              │                     └─ ids ─▶ Prisma (owner check, filters, details)
                              └─ getArticle ─────▶ Prisma
Worker: processArticleJob ─▶ indexArticle      Cleanup ─▶ reconcile
Startup ─▶ backfill
```

### Search index — `src/lib/search/searchIndex.ts`

The only module that touches the index file.

- **File.** `search.sqlite` in the same directory as the main database (derived
  from `DATABASE_URL`), opened through its own `better-sqlite3` connection in
  WAL mode. The file is derived data: deleting it causes a full rebuild on the
  next start.
- **Table.**
  `article_fts(title, lead, body, user_id UNINDEXED, published UNINDEXED)` using
  `tokenize='porter unicode61 remove_diacritics 2'`. The `rowid` is the article
  id. `published` is stored as an ISO 8601 string so date ranges compare as
  text.
- **Content.** Title, lead (if present) and scraped text; when there is no
  scrape, the RSS `description`. Articles are indexed regardless of status.
- **`indexArticle(articleId)`** loads the article with lead and scrape and runs
  `INSERT OR REPLACE`. Repeating it is harmless.
- **`search(userId, terms, options)`** where `options` is
  `{ from?, to?, sort: "relevance" | "newest" | "oldest", limit }`. Each term is
  wrapped in double quotes (inner quotes doubled) and the terms are joined with
  `OR`, so the LLM never writes FTS syntax and malformed queries cannot occur.
  BM25 ranks articles matching more terms higher. Column weights favor title,
  then lead, then body. Returns `{ articleId, snippet }[]`, the snippet coming
  from FTS5 `snippet()` over the body (about 24 tokens).
- **`reconcile(existingIds)`** deletes rows whose rowid is not in the set.
- **`backfill()`** indexes every article id missing from the index, 500 per
  transaction, yielding to the event loop between batches.
- If opening the file fails, or a query throws `SQLITE_CORRUPT`, the module logs
  the error, deletes the file and recreates the table; the next backfill fills
  it.

### Keeping the index current

- `processArticleJob` calls `indexArticle` after the lead is generated. A job
  that fails earlier is retried by the queue and indexes on success.
- `runCleanup` reads all article ids through Prisma and calls `reconcile`. This
  covers the 365-day purge, feed deletion and user deletion with a single hook.
- `instrumentation.ts` starts `backfill()` in the background after the worker
  starts. It does nothing when the index is complete, and is skipped when
  `BACKGROUND_WORKER_DISABLED` is set.

Between an article's deletion and the next cleanup, its row may still match.
That is harmless because search results are always loaded through Prisma (see
below) and missing ids are dropped.

### Chat tools — `src/lib/ai/chat/tools.ts`

`createChatTools(userId)` returns two AI SDK tools bound to that user. The LLM
has no way to supply a user id.

- **`searchArticles`**
  - Input: `terms` (1–10 strings), `from?` and `to?` (ISO dates), `sort`
    (default `relevance`), `status?` (`UNREAD | READ_LATER | READ | FILTERED`),
    `starred?`, `limit` (1–25, default 10).
  - Asks the index for `limit × 4` (at most 100) ids, then loads them through
    Prisma with `userId`, `status` and `starred` applied, keeps index order, and
    cuts to `limit`. Returns, per article: id, title, feed title, publication
    date, status, starred, lead, snippet and the in-app path
    `/feed/{feedId}/article/{id}/text-summary`.
  - Returns `{ results: [] }` rather than an error when nothing matches.
- **`getArticle`**
  - Input: `id`.
  - Returns the same fields plus the original link and the article text (scrape,
    else description). Text beyond 60,000 characters (about 15k tokens) is cut,
    with a note saying so. The cap only guards against outliers such as long
    PDFs; the longest scraped article in current data is under 50,000
    characters. Returns `{ error: "not found" }` for ids that do not exist or
    belong to someone else; the two cases are indistinguishable.

### Chat endpoint — `src/app/api/chat/route.ts`

- `POST` only. Reads the session through Better Auth; responds `401` without
  one.
- Accepts the AI SDK UI message list from `useChat` and sends the whole
  conversation to the model: every question and every answer. Tool results from
  earlier turns are compacted to the id, title and path of each article they
  returned, so earlier search payloads are not paid for again on every later
  turn; the current turn keeps full tool results. Follow-up questions still
  work, because answers cite article paths and the model can open any of them
  again with `getArticle`.
- Calls `streamText` with:
  - the model from `getFirstConfiguredLanguageModel()`,
  - the tools from `createChatTools(userId)`,
  - a step limit of 10,
  - the chat system prompt (below).
- Streams back with the AI SDK UI message stream response.
- On finish, records total usage across all steps with `trackTokenUsage`.
  Failures are logged in the same shape as `streamGeneration`.

**Chat system prompt** (in `src/lib/ai/prompts.ts`):

- Today's date, so "this year" and "last week" resolve.
- Answer only from tool results; if they hold nothing relevant, say that the
  reader's feeds do not cover it.
- Before answering, search with several synonyms, names and tickers; if a search
  returns little, try a second round with different words. Use `sort: oldest` to
  find when something first appeared.
- Cite every claim with a Markdown link to the article's in-app path; list
  sources at the end of longer answers.
- Answer in the language of the question. Keep it concise.

### Chat page — `src/app/chat/page.tsx` and `src/components/chat/`

- A page with the standard top navigation, a message list and an input box at
  the bottom. Uses `useChat` against `/api/chat`; state is in-memory only.
- Assistant text renders as Markdown with `markdown-to-jsx`; links to in-app
  paths use Next `Link`. Answer text uses `text-prose` within `max-w-content`.
- Tool calls render as one muted line each, e.g. "Searched: Alphabet, Google,
  GOOGL · 2026" and "Read: _article title_", so the reader sees what was looked
  at.
- While streaming, the send button becomes a stop button (`stop()`).
- An empty page shows the three example questions from Intent as clickable
  suggestions.
- "New chat" clears the conversation.
- A "Chat" item in the left navigation; `/chat` and `/chat/:path*` added to the
  proxy matcher.

### Error handling

| Situation                               | Behavior                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Not signed in                           | Proxy redirects the page to sign-in; the endpoint returns `401`.                                                 |
| Provider error or network failure       | The message list shows an error line with a "Retry" button (`regenerate()`); the error is logged server-side.    |
| Step limit reached without a final text | The last step's partial answer is shown; the system prompt asks for an answer by the last step.                  |
| Index unavailable or corrupt            | The tool returns `{ error }`, the LLM tells the reader search is unavailable; the index rebuilds itself (above). |
| Index still backfilling                 | Searches run against what is indexed so far; no special handling.                                                |
| Reader aborts                           | `stop()` ends the stream; usage for completed steps is still recorded where the SDK reports it.                  |

## Testing

- **Unit, `searchIndex`** (temporary file per test): indexing and replacing,
  term quoting with quotes and FTS operators in input, `OR` ranking (more
  matched terms rank higher), date range, all three sort orders, user isolation,
  `reconcile`, `backfill` filling only missing rows, and rebuild after a corrupt
  file.
- **Integration, tools** (test database as in existing integration tests):
  results scoped to the user, ids deleted from Prisma but still indexed are
  dropped, `status` and `starred` filters, `limit` applied after filtering,
  `getArticle` truncation and not-found for another user's article.
- **Unit, history compaction**: tool results from earlier turns shrink to id,
  title and path; the current turn is left untouched.
- **Integration, endpoint**: `401` without a session; with the AI SDK's mock
  language model, a tool call round trip streams a final answer and records
  token usage.
- **Components, chat page**: renders Markdown answers with in-app links, tool
  call lines, the stop button while streaming, the error line with Retry, and
  the empty-state suggestions.
- **Job hooks**: `processArticleJob` indexes the article; `runCleanup` removes
  index rows for purged articles.

## Rough size

About 8–10 new files (index module, tools, route, prompt, page and three or four
components, tests) and small edits to `processArticleJob`, `runCleanup`,
`instrumentation.ts`, `proxy.ts`, the left navigation and the README feature
list. Comparable to the audio briefing feature.
