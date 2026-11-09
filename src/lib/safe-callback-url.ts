const DEFAULT_CALLBACK_URL = "/feed";

const isProtocolRelative = (value: string) =>
  value.startsWith("//") || value.startsWith("/\\");

/**
 * Reduces a user-supplied `callbackURL` query parameter to a same-origin path,
 * so sign-in cannot be used as an open redirect.
 */
export const safeCallbackURL = (
  value: string | string[] | undefined,
): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    isProtocolRelative(value) ||
    // The URL parser silently strips tab/CR/LF, which can yield an invalid URL.
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return DEFAULT_CALLBACK_URL;
  }

  // The URL parser treats `\` like `/`, so it must be the one to judge origin.
  const base = "http://placeholder.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return DEFAULT_CALLBACK_URL;
  }

  if (url.origin !== base) {
    return DEFAULT_CALLBACK_URL;
  }

  // Dot-segment removal can turn `/.//evil.com` into `//evil.com`, so the
  // normalised result must be checked again.
  const result = url.pathname + url.search + url.hash;

  return isProtocolRelative(result) ? DEFAULT_CALLBACK_URL : result;
};
