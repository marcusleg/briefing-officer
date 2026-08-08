/**
 * The article's headline as it should be spoken, terminated as its own
 * sentence.
 *
 * Constructed rather than generated. The title is already known exactly, so
 * involving the model could only risk it paraphrasing or translating the
 * headline — and speaking it from code means playback starts the moment the
 * page opens, without waiting on the model's first token. The generated script
 * picks up from the publication onwards.
 *
 * Headlines frequently end in "?" or "!". Replacing that with a period would
 * change how the voice reads the line, and appending one after it reads as an
 * audible stumble, so an existing terminator is left alone.
 */
export const spokenTitle = (title: string): string => {
  const trimmed = title.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * Splits a buffer into complete sentences plus whatever is left over.
 *
 * The audio script prompt asks the model to put each sentence on its own line,
 * so the delimiter is a newline rather than something inferred from
 * punctuation. That keeps this free of language-specific knowledge: an English
 * abbreviation list would mis-split German ("z.B.") and every other language in
 * its own way.
 *
 * If the model emits no newlines at all, the whole briefing becomes one
 * utterance and hits Chrome's ~15-second truncation. Accepted, not defended
 * against — see docs/superpowers/specs/2026-08-06-article-language-design.md.
 *
 * Safe to call repeatedly against a growing stream: feed the remainder back in
 * with the next delta appended.
 */
export const splitIntoSentences = (
  buffer: string,
): { sentences: string[]; remainder: string } => {
  const lines = buffer.split("\n");

  // Whatever follows the final newline is a sentence the stream has not
  // finished delivering. It is left untrimmed because the caller appends the
  // next delta directly to it.
  const remainder = lines.pop() ?? "";

  return {
    sentences: lines.map((line) => line.trim()).filter((line) => line !== ""),
    remainder,
  };
};
