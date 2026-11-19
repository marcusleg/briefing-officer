# Server-Side Speech for Audio Summaries

## Intent

The audio summary page reads its briefing aloud through the browser's Web
Speech API. Quality depends entirely on the voices installed on the reader's
device: Linux without speech-dispatcher has none, and the defaults elsewhere
sound robotic. Operators who run a text-to-speech model, such as Kokoro behind
an OpenAI-compatible gateway or OpenAI's own TTS, should be able to have the
briefing read by that model instead.

Kokoro and many other TTS models speak only some languages, so the server voice
is used only for articles in a language it supports. Every other article keeps
today's browser speech.

## Goals

- An OpenAI-compatible TTS provider, configured with its own `OPENAI_TTS_*`
  environment variables, reads audio summaries in the languages it is
  configured for.
- Every other case (no TTS configured, or an article language the voice does not
  cover) behaves exactly as it does today.
- Playback still starts before the whole script is generated: sentences are
  synthesized as they stream in.
- The player's controls, transcript and highlighting are unchanged.

## Non-goals

- Other TTS APIs (ElevenLabs, Azure Speech, Google Cloud TTS). The provider
  registry leaves room for them; none is built now.
- A per-user voice choice or any settings UI. The voice is instance-wide.
- Caching synthesized audio on the server. The script itself is regenerated on
  every visit.
- Tracking TTS usage alongside token usage.
- Switching to browser speech mid-briefing when the server voice fails.

## Design

### Configuration

Provider-specific variables, mirroring how language models are configured
(`ANTHROPIC_*`, `AZURE_OPENAI_*`, `OPENAI_*`). They are separate from
`OPENAI_*` so an instance that generates text with Anthropic can still use an
OpenAI-compatible TTS service.

| Variable               | Meaning                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `OPENAI_TTS_BASE_URL`  | Optional. Defaults to `https://api.openai.com/v1`.                            |
| `OPENAI_TTS_API_KEY`   | API key for the TTS service.                                                  |
| `OPENAI_TTS_MODEL`     | Speech model, e.g. `gpt-4o-mini-tts` or `kokoro-latest`.                      |
| `OPENAI_TTS_VOICE`     | Voice, e.g. `alloy` or `af_heart`.                                            |
| `OPENAI_TTS_LANGUAGES` | Comma-separated ISO 639-1 codes the voice may read. Defaults to `en`.         |

The provider is configured when `OPENAI_TTS_MODEL` and `OPENAI_TTS_VOICE` are
both set. The API key is not required, because local services often run without
one. Language codes are trimmed and lowercased; empty entries are ignored.

The base URL and key are always passed to `createOpenAI` explicitly (the key as
an empty string when unset). Left `undefined`, the SDK falls back to
`OPENAI_BASE_URL` and `OPENAI_API_KEY`, which would send the language-model
credentials to the TTS service.

### Speech provider registry

Modeled on `src/lib/ai/registry.ts` and `src/lib/ai/providers/`.

- `src/lib/ai/speech-providers/openAi.ts` exports a factory returning
  `{ isConfigured, languages, voice, create() }`, where `create()` returns
  `createOpenAI({ baseURL, apiKey }).speech(model)`.
- `src/lib/ai/speechRegistry.ts` exports `getSpeechModelFor(language)`. It
  resolves a `null` language to `DEFAULT_LANGUAGE` and returns the first
  configured provider whose `languages` include it, as `{ model, voice }`, or
  `undefined`.

Synthesis goes through the AI SDK's `generateSpeech`, which is
provider-neutral, so a later ElevenLabs or Azure provider adds a file under
`speech-providers/` and its own variables without touching the route or the
client.

### `POST /api/speech`

`src/app/api/speech/route.ts`. Body: `{ articleId: number, text: string }`.

1. No session: 401.
2. `text` empty after trimming or longer than 4,096 characters, or `articleId`
   not a positive 32-bit integer: 400. The cap keeps the route from serving as a
   general TTS proxy; briefing sentences are far shorter, and 4,096 (the input
   limit of OpenAI's TTS API) still reads a script that arrived without line
   breaks as one clip.
3. Article missing or owned by another user: 404.
4. `getSpeechModelFor(article.language)` returns nothing: 422. The page never
   selects server speech in that case, so this is a guard, not a flow.
5. `generateSpeech({ model, voice, text, outputFormat: "mp3", maxRetries: 1,
   abortSignal: request.signal })`. On success, respond 200 with the audio bytes
   and the returned media type (`audio/mpeg`). On failure, log it and respond
   502.

The language comes from the article on the server, never from the client, so a
client cannot make the voice read text in a language it was not configured for.

### Engine selection

The audio summary page (a server component) calls
`getSpeechModelFor(article.language)` and passes
`engine: "server" | "browser"` to `AudioSummaryPlayer`, which renders one of two
thin wrappers, each calling exactly one speech hook and handing its controls to
the shared player body. Mounting only the selected hook matters: the browser
hook claims the global `speechSynthesis` on mount, and an idle instance on a
server-speech page would take that ownership from the outgoing page, leaving
its speech playing. Script streaming, transcript and controls are shared.

### `useServerSpeech`

`src/hooks/use-server-speech.ts`, taking `articleId`. Returns the same
controls interface as `useSpeechSynthesis`, plus `buffering` and `error`. The shared interface is
extracted into a `SpeechControls` type both hooks return; the browser hook
always reports `false` for both.

- **Queue.** Sentences are retained in a ref, as in the browser hook. Each index
  maps to a pending request resolving to an object URL. One `HTMLAudioElement`
  per hook instance. No module-level owner token is needed: during the overlap a
  client-side navigation creates, each page has its own element.
- **Prefetch.** The playing sentence and the next two are requested, at most two
  requests in flight. A sentence that streams in inside that window is
  requested immediately.
- **Advancing.** On `ended`, the next sentence plays if its audio is ready.
  Otherwise `buffering` is true until it is. If the playing sentence was the
  last one retained, playback enters the same "ran dry" state as the browser
  hook (not buffering: the hook cannot tell a slow script from a finished one)
  and resumes when `enqueue()` adds the next sentence.
- **Structure.** The queue logic lives in a framework-free
  `ServerSpeechQueue` class (`src/lib/server-speech-queue.ts`) that publishes a
  snapshot; the hook binds it to React with `useSyncExternalStore` and disposes
  it on unmount. The queue's callbacks call each other (a clip arriving starts
  playback, playback ending requests more), which a class expresses without
  the circular `useCallback` dependencies a hook body would need.
- **`activeIndex`** is set when a sentence's audio actually starts playing.
- **Speed.** `setRate` sets `playbackRate` and `defaultPlaybackRate` on the
  element (loading a new `src` resets the former to the latter; browsers keep
  pitch by default). No refetch, no restart.
- **Pause and resume** call `audio.pause()` and `audio.play()`.
- **`playFrom(i)`** stops the current sentence and plays from `i`, reusing
  audio already fetched.
- **Autoplay.** Arriving by client-side navigation keeps the user's activation,
  so playback starts on its own as today. On a cold load or reload `play()`
  rejects with `NotAllowedError`; the hook then sits paused on sentence 0 and
  the Play button starts it. No error is shown.
- **Unmount** aborts in-flight requests, pauses the element and revokes every
  object URL.
- **`supported` and `voiceAvailable`** are always `true`.

### Player changes

- The Play button shows the shadcn `Spinner` while `buffering` and playback is
  not paused.
- "Playback unavailable" and "Voice unavailable" alerts stay specific to the
  browser engine; their conditions cannot arise with server speech.
- A new alert, shown when the server hook reports a failure:
  **"Speech unavailable"**: "The speech service could not read this briefing
  aloud. Press play to try again. The transcript below is unaffected."

### Error handling

A sentence whose request fails (non-2xx or network error, after the route's
own single retry) stops playback at that sentence: the hook reports `error` and
`paused`. Pressing Play calls `resume()`, which clears the error and retries
from that sentence. Aborted
requests (unmount, `playFrom`) are not errors. The transcript keeps streaming
regardless.

### Documentation

- `.env.example` and the README configuration table list the five
  `OPENAI_TTS_*` variables.
- The Helm chart passes arbitrary variables through `env` and needs no change.

## Testing

- **Unit, speech provider and registry:** configured only with model and voice;
  `OPENAI_TTS_LANGUAGES` parsing (comma-separated, trimmed, case-insensitive,
  default `en`); `getSpeechModelFor("de")` is `undefined` for an `en`-only
  provider; `null` resolves to the default language.
- **Integration, `/api/speech`** (pattern of `tests/integration/chatRoute.test.ts`,
  `generateSpeech` mocked): 401, 400, 404, 422, 502, and 200 with `audio/mpeg`
  bytes; the article's language decides the provider.
- **Hook, `useServerSpeech`** (fake `Audio` and `fetch`): plays in order;
  two-ahead prefetch window; `buffering` while the next audio is pending;
  resumes after running dry when a sentence is enqueued; `playFrom` reuses
  fetched audio; `setRate` sets `playbackRate` without fetching; a rejected
  `play()` leaves it paused; unmount aborts and revokes; a failed request stops
  playback and sets `error`, and Play retries.
- **Component, `AudioSummaryPlayer`:** `engine="server"` drives the server hook,
  hides the browser-voice alerts, shows the spinner while buffering and the
  "Speech unavailable" alert on error.
- **Manual smoke test** against the local gateway with `kokoro-latest` and
  `af_heart`: an English article plays through the server voice; a German
  article falls back to browser speech.
