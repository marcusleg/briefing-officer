/**
 * Words that end in a period without ending a sentence. Lowercased, without
 * the trailing period.
 */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "eg",
  "ie",
  "approx",
  "inc",
  "ltd",
  "co",
  "fig",
]);

const isSentenceEnd = (buffer: string, index: number): boolean => {
  const character = buffer[index];
  if (character !== "." && character !== "!" && character !== "?") {
    return false;
  }

  // A terminator only counts once the following character confirms it. Without
  // this, a buffer ending in "3." would split a decimal that has not finished
  // arriving. The caller flushes whatever remains when the stream closes.
  if (!/\s/.test(buffer[index + 1] ?? "")) {
    return false;
  }

  if (character !== ".") {
    return true;
  }

  // An ellipsis is a pause inside a sentence, not the end of one.
  if (buffer[index - 1] === ".") {
    return false;
  }

  const precedingWord = /([A-Za-z]+)$/.exec(buffer.slice(0, index))?.[1];
  if (!precedingWord) {
    return true;
  }

  // A single letter before a period is an initial or part of an acronym:
  // "U.S.", "J. R. R. Tolkien".
  if (precedingWord.length === 1) {
    return false;
  }

  // An ordinal number (1st, 21st, etc.) is a real sentence end, not an abbreviation.
  // The letter-run regex yields just the letters ("st" from "1st"), so check if a
  // digit precedes the word. If there is, it is an ordinal and ends the sentence.
  const characterBeforeWord = buffer[index - precedingWord.length - 1];
  if (/\d/.test(characterBeforeWord)) {
    return true;
  }

  return !ABBREVIATIONS.has(precedingWord.toLowerCase());
};

/**
 * Splits a buffer into complete sentences plus whatever is left over. Safe to
 * call repeatedly against a growing stream: feed the remainder back in with the
 * next delta appended.
 */
export const splitIntoSentences = (
  buffer: string,
): { sentences: string[]; remainder: string } => {
  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < buffer.length; index++) {
    if (!isSentenceEnd(buffer, index)) {
      continue;
    }

    const sentence = buffer.slice(start, index + 1).trim();
    if (sentence) {
      sentences.push(sentence);
    }
    start = index + 1;
  }

  // trimStart() only: the caller feeds this remainder back with the next
  // delta appended, so a trailing space here is a real separator between two
  // words that have not both arrived yet. Trimming it away glues them
  // together. The leading trim is still wanted — it strips the space that
  // followed a terminator.
  return { sentences, remainder: buffer.slice(start).trimStart() };
};

/**
 * Builds the spoken introduction. This is constructed rather than generated:
 * the title, author, and feed are already known, so involving the model would
 * only risk it paraphrasing the title or inventing an author.
 *
 * The author is spoken verbatim. Readability's byline is unreliable, but
 * cleaning it up here would create a second place that knows how to tidy
 * bylines and make the real fix harder — see the design's non-goals.
 */
export const buildOpeningLine = (
  title: string,
  author: string | null | undefined,
  feedTitle: string,
): string => {
  const trimmedTitle = title.trim();

  // The title terminates as its own sentence. Headlines frequently end in "?"
  // or "!", and running those into a comma reads as an audible glitch.
  const introduction = /[.!?]$/.test(trimmedTitle)
    ? trimmedTitle
    : `${trimmedTitle}.`;

  // The scraper stores "" when Readability finds no byline. Without this
  // branch the line would read "Written by , from Hacker News".
  const trimmedAuthor = author?.trim();
  if (!trimmedAuthor) {
    return `${introduction} From ${feedTitle}.`;
  }

  return `${introduction} Written by ${trimmedAuthor}, from ${feedTitle}.`;
};
