import { compareInboxOrder } from "@/lib/article";
import { INBOX_SCOPE, isInScope, scopeWhere } from "@/lib/articleScope";
import { describe, expect, it } from "vitest";

describe("isInScope", () => {
  it("keeps an article whose status the scope lists", () => {
    expect(
      isInScope(INBOX_SCOPE, { status: "READ_LATER", starred: false }),
    ).toBe(true);
  });

  it("drops an article whose status the scope does not list", () => {
    expect(isInScope(INBOX_SCOPE, { status: "READ", starred: false })).toBe(
      false,
    );
  });

  it("drops an unstarred article from a starred-only scope", () => {
    const starred = { starredOnly: true };
    expect(isInScope(starred, { status: "READ", starred: true })).toBe(true);
    expect(isInScope(starred, { status: "READ", starred: false })).toBe(false);
  });

  it("keeps everything in an empty scope", () => {
    expect(isInScope({}, { status: "FILTERED", starred: false })).toBe(true);
  });
});

describe("scopeWhere", () => {
  it("turns a scope into the matching query", () => {
    expect(scopeWhere(INBOX_SCOPE)).toEqual({
      status: { in: ["UNREAD", "READ_LATER"] },
    });
    expect(scopeWhere({ starredOnly: true })).toEqual({ starred: true });
    expect(scopeWhere({})).toEqual({});
  });
});

describe("compareInboxOrder", () => {
  const at = (status: "UNREAD" | "READ_LATER", day: number) => ({
    status,
    publicationDate: new Date(Date.UTC(2026, 8, day)),
  });

  it("puts unread newest first, then read later oldest first", () => {
    const sorted = [
      at("READ_LATER", 20),
      at("UNREAD", 1),
      at("READ_LATER", 5),
      at("UNREAD", 10),
    ].sort(compareInboxOrder);

    expect(sorted).toEqual([
      at("UNREAD", 10),
      at("UNREAD", 1),
      at("READ_LATER", 5),
      at("READ_LATER", 20),
    ]);
  });
});
