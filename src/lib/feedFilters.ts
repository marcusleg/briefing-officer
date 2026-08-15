/**
 * Seeded into every new feed's disinterest list. Written as data rather than
 * enforced in code so the reader can delete them — a default that cannot be
 * removed is a policy, and this one is only a good guess.
 */
export const DEFAULT_DISINTERESTS = [
  "advertisements",
  "sponsored posts",
] as const;

/**
 * Entries arrive from three places — seeded defaults, the "not interested"
 * popover, and the feed form — so duplicates are a matter of time. The
 * database's unique constraint is the backstop; this is the pass that lets
 * `createMany` be used at all, since Prisma's SQLite connector does not
 * support `skipDuplicates`.
 *
 * Comparison is case-insensitive but the first spelling is what gets stored:
 * the reader typed it that way, and the model reads it either way.
 */
export const dedupeKeywords = (entries: string[]): string[] => {
  const seen = new Set<string>();

  return entries.reduce<string[]>((kept, entry) => {
    const text = entry.trim();
    const key = text.toLowerCase();

    if (text === "" || seen.has(key)) {
      return kept;
    }

    seen.add(key);
    return [...kept, text];
  }, []);
};

/**
 * A keyword list is a set the reader scans, not a history of when each entry
 * was added — insertion order carries no meaning, and it makes a particular
 * entry hard to find once the list grows. Sorting alphabetically gives the
 * reader a fixed place to look.
 *
 * Case-insensitive and locale-aware, so "Zebra" sorts next to "apple" rather
 * than before it. Returns a new array; the input is left untouched.
 */
export const sortKeywords = (entries: string[]): string[] =>
  [...entries].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

/**
 * The two lists in one sentence, shown under the fields that produce them.
 *
 * It exists because the mode is derived rather than selected: adding a first
 * interest entry silently narrows the feed from everything to only that, which
 * is the one sharp edge in having no mode control. A sentence the reader reads
 * before saving turns that from a surprise into a choice.
 */
export const describeFilters = (
  interests: string[],
  disinterests: string[],
): string => {
  if (interests.length === 0 && disinterests.length === 0) {
    return "No filtering — every article from this feed is kept.";
  }

  if (interests.length === 0) {
    return `Everything except ${disinterests.join(", ")}.`;
  }

  if (disinterests.length === 0) {
    return `Only ${interests.join(", ")}.`;
  }

  return `Only ${interests.join(", ")}, except ${disinterests.join(", ")}.`;
};
