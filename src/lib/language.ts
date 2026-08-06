/**
 * The language an article's generated text is written in.
 *
 * The model reports a language alongside the lead it generates (see
 * leadService). Only values that survive `normalizeLanguage` are stored, and a
 * null language means "never established", which resolves to English wherever
 * it is read.
 */

export const DEFAULT_LANGUAGE = "en";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

/**
 * Reduces a model-supplied language to a storable ISO 639-1 code, or null.
 *
 * The order of the checks is load-bearing:
 *
 * - `Intl.DisplayNames.of("")` throws a RangeError rather than returning a
 *   value, so the shape check is what keeps the lookup below safe.
 * - `.of("deu")` returns "German" and `.of("und")` returns "root", so neither
 *   ISO 639-2 codes nor the undetermined sentinel are caught by the
 *   recognition check. The two-letter rule is the only thing that rejects
 *   them. Reordering these would store both — and set them as
 *   `utterance.lang`, where no browser matches them to a voice.
 */
export const normalizeLanguage = (
  value: string | null | undefined,
): string | null => {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0] ?? "";

  if (!/^[a-z]{2}$/.test(code)) {
    return null;
  }

  // A well-formed but unrecognised tag echoes itself back.
  return languageNames.of(code) === code ? null : code;
};

/**
 * The English name of a language, for prompt directives and reader-facing
 * copy. The interface is English, so the names are too.
 */
export const languageDisplayName = (language: string | null): string =>
  languageNames.of(language ?? DEFAULT_LANGUAGE) ?? "English";
