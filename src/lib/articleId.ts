/** The largest id an article can have: the database stores ids as 32-bit. */
export const MAX_ARTICLE_ID = 2_147_483_647;

/**
 * Whether a value can be an article's id. Anything else would make the
 * database reject the whole query it appears in, so ids from requests and
 * model output are checked first.
 */
export const isArticleId = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) > 0 &&
  (value as number) <= MAX_ARTICLE_ID;
