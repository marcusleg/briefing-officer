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
 * The order is load-bearing. `Intl.DisplayNames.of("")` throws, so the shape
 * check has to run first; and `.of("deu")` returns "German" while `.of("und")`
 * returns "root", so the two-letter rule — not the recognition check — is the
 * only thing rejecting ISO 639-2 codes and the undetermined sentinel.
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
  // The `??` only satisfies the `string | undefined` return type. `of()` echoes
  // a structurally valid tag back rather than returning undefined.
  languageNames.of(language ?? DEFAULT_LANGUAGE) ?? DEFAULT_LANGUAGE;
