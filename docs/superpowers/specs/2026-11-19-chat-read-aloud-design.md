# Read Chat Answers Aloud

## Intent

Audio summaries can be listened to, but chat answers can only be read. A reader
should be able to have any finished answer on `/chat` read aloud with one click,
by the same voice that reads audio summaries.

## Goals

- A speaker button under every finished chat answer reads it aloud and stops it.
- The configured speech service reads the answer when it covers English;
  otherwise the browser's voices do, exactly as for audio summaries.
- Playback starts after one sentence has been synthesized, not the whole answer.
- Only speakable prose is read: no URLs, code, images or the sources list.

## Non-goals

- Detecting the answer's language. Every answer is read as English
  (`DEFAULT_LANGUAGE`). A non-English answer is read by the English voice.
- Speed control. Playback runs at 1.0x and ignores the speed saved on the audio
  summary page.
- Pause and resume, a transcript, or highlighting the sentence being read.
- Reading an answer while it is still being written.
- Reading the reader's own questions.

## Constraints

- Next.js 16.4 and AI SDK 7. Read `node_modules/next/dist/docs/` before
  changing the route handler.
- `/api/speech` keeps its session check and its 4,096-character cap per request.
- Design rules from `AGENTS.md`: color only through tokens, flat surfaces.

## Design

### Overview

```
/chat page (server) ── engine: getSpeechModelFor(null) ? "server" : "browser"
  └─ Chat ── readingId
       └─ ChatMessage ── actions: ReadAloud
            └─ ChatSpeech (mounted only while reading, keyed by message id)
                 ├─ server: useServerSpeech() ─▶ POST /api/speech { text }
                 └─ browser: useSpeechSynthesis(null)
```

### What the reader sees

- An assistant answer shows a `MessageActions` row with one ghost icon button
  once the answer has finished and has text. While the answer is still being
  written, the button is not rendered.
- The button has three states:
  - Idle: `Volume2Icon`, labeled "Read aloud".
  - Waiting for the first clip (`buffering`): a `Spinner`, labeled "Stop
    reading".
  - Reading: `SquareIcon`, labeled "Stop reading".
- Clicking while reading or waiting stops playback. When the last sentence ends,
  the button returns to idle.
- Only one answer is read at a time. Starting another answer stops the current
  one. "New chat" stops playback.
- If a clip fails, playback stops, the button returns to idle and a toast says
  "This answer could not be read aloud." The same toast appears, and nothing
  plays, when the browser engine is clicked in a browser with no voices at all.
- With the browser engine and no English voice installed, the browser's default
  voice reads the answer, as on the audio summary page.
- With the browser engine in a browser without `speechSynthesis`, the button is
  not rendered.

### Spoken text — `src/lib/chat-speech-text.ts`

`spokenSentences(markdown: string): string[]` turns an answer into the sentences
to read. It is pure and has no React or DOM dependency.

1. Parse with `unified`, `remark-parse` and `remark-gfm`, the parsers Streamdown
   renders answers with. They are already in the lockfile through Streamdown and
   become direct dependencies.
2. Walk the tree and collect text blocks. Each paragraph, heading, list item,
   table cell and blockquote paragraph is one block.
   - Links contribute their text, never their URL.
   - Emphasis, strong, delete and inline code contribute their text.
   - Code blocks, math, images, HTML, footnote references and footnote
     definitions are skipped.
   - A list item whose only content is a link is skipped. Answers end with a
     list of their sources, and such items are only citations.
   - Whitespace inside a block collapses to single spaces.
3. Split each block with `Intl.Segmenter("en", { granularity: "sentence" })`
   and trim the segments, dropping empty ones. Splitting per block keeps a
   heading or list item without a final period as its own sentence.
4. A sentence longer than 4,096 characters is broken at the last whitespace
   before the limit (or at the limit when there is none), repeatedly, so every
   request fits the route's cap.

This is separate from `splitIntoSentences` in `src/lib/audio-script.ts`, which
splits on newlines because the audio script prompt puts one sentence per line.

### Route — `src/app/api/speech/route.ts`

`articleId` becomes optional in the request body.

- **With `articleId`:** unchanged. It must be a valid id of an article the user
  owns (otherwise 400 or 404), and the article's language picks the voice.
- **Without `articleId`:** the language is `DEFAULT_LANGUAGE`.
  `getSpeechModelFor(null)` picks the voice; when none covers English, the route
  answers 422.
- A body with `articleId` present but invalid (not a positive safe integer
  within range) is still a 400. Only an absent `articleId` means "no article".
- Session (401), text validation (400), synthesis failure (502) and the response
  format are unchanged. The failure log includes `articleId` only when one was
  sent.

### Speech engines

- `ServerSpeechQueue` takes `articleId: number | undefined` and leaves
  `articleId` out of the request body when it is undefined. `useServerSpeech`
  takes an optional `articleId` and passes it through.
- `useSpeechSynthesis(null)` already resolves to English and needs no change.
- Both hooks start at rate 1. Chat never calls `setRate`.
- Unmounting stops playback in both: `useServerSpeech` disposes its queue, and
  `useSpeechSynthesis` cancels `speechSynthesis` when it owns it.

### Chat page — `src/app/chat/page.tsx`

The server component computes
`speechEngine = getSpeechModelFor(null) ? "server" : "browser"` and renders
`<Chat speechEngine={speechEngine} />`.

### Chat — `src/components/chat/chat.tsx`

- Takes `speechEngine: "server" | "browser"`.
- Holds `readingId: string | undefined`, the id of the answer being read.
- Passes each `ChatMessage` a `<ReadAloud>` as `actions`, with the engine,
  `messageText(message)`, `reading={message.id === readingId}`,
  `onRead={() => setReadingId(message.id)}` and a stable `onReadEnd` that
  clears `readingId`.
- `startOver` also clears `readingId`.

### Message — `src/components/chat/chat-message.tsx`

- Takes an optional `actions: ReactNode`, rendered below an assistant answer
  only when it is not `answering`. `ChatMessage` knows nothing about speech.
- Exports `messageText(message)`: the message's text parts joined with blank
  lines.

### Read aloud — `src/components/chat/read-aloud.tsx`

- **`ReadAloud`** takes `engine`, `text` (the answer's Markdown), `reading`,
  `onRead` and `onReadEnd`, and renders a `MessageActions` row holding the
  button.
  - It renders nothing when `spokenSentences(text)` is empty, or for the browser
    engine when `"speechSynthesis" in window` is false. That check goes through
    `useSyncExternalStore` with a server snapshot of `false`, so the server
    render and the first client render agree.
  - Idle, a click calls `onRead`. For the browser engine it first checks
    `speechSynthesis.getVoices()`: with no voices the toast appears instead,
    because such a browser accepts utterances but never plays or ends them.
  - When `reading`, it mounts `ServerChatSpeech` or `BrowserChatSpeech`, each of
    which calls only its own engine's hook and renders `ChatSpeech`, as the
    audio summary player does.
- **`ChatSpeech`** renders the stop button (spinner while `buffering`), which
  calls `onReadEnd`. On mount it enqueues the sentences once (a ref guards
  against Strict Mode's remount, which then only calls `playFrom(0)` again) and
  calls `playFrom(0)`. It calls `onReadEnd` once `speaking` has been true and
  turns false, and on `error` shows the toast and calls `onReadEnd`. Each fires
  at most once.

## Error handling

| Case                                  | Behavior                                         |
| ------------------------------------- | ------------------------------------------------ |
| Session expired                       | Route 401, clip fails, toast, button idle        |
| No English voice on the server        | Engine is "browser"; the route's 422 is a backstop |
| Synthesis failure                     | Route 502, clip fails, toast, button idle        |
| Browser without `speechSynthesis`     | Button not rendered                              |
| Browser with no voices at all         | Toast on click, nothing plays                    |
| Browser with no English voice         | The default voice reads the answer               |
| Navigating away or "New chat"         | `ChatSpeech` unmounts and playback stops         |

## Testing

- **Unit, `spokenSentences`:** paragraphs split into sentences; headings and
  list items without periods stay separate sentences; links read as their text;
  code blocks, images, HTML and footnotes skipped; link-only list items skipped;
  whitespace collapsed; a sentence over 4,096 characters split at whitespace;
  empty input returns no sentences.
- **Integration, `/api/speech`:** without `articleId`, the English provider
  synthesizes the text; without `articleId` and no English voice, 422; an
  invalid `articleId` is still 400. Existing cases keep passing.
- **Unit, `ServerSpeechQueue`:** without an article id, the request body has no
  `articleId`.
- **Component, chat** (with `tests/helpers/server-speech.ts`):
  - the button is not rendered while an answer is being written;
  - clicking reads the answer's sentences and the button shows stop; clicking
    again stops;
  - starting a second answer stops the first;
  - reaching the end returns the button to idle;
  - a failed clip shows the toast and returns the button to idle;
  - the browser engine without `speechSynthesis` renders no button.
