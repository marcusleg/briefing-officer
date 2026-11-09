import { safeCallbackURL } from "@/lib/safe-callback-url";
import { describe, expect, it } from "vitest";

describe("safeCallbackURL", () => {
  it.each([
    ["/settings", "/settings"],
    ["/settings?tab=a#x", "/settings?tab=a#x"],
    [undefined, "/feed"],
    ["", "/feed"],
    [["/settings", "/feed"], "/feed"],
    ["settings", "/feed"],
    ["//evil.com", "/feed"],
    ["/\\evil.com", "/feed"],
    ["https://evil.com/settings", "/feed"],
    ["javascript:alert(1)", "/feed"],
    ["/.//evil.com", "/feed"],
    ["/..//evil.com", "/feed"],
    ["/a/..//evil.com", "/feed"],
    ["/%2e//evil.com", "/feed"],
    ["/./\\evil.com", "/feed"],
    ["/\t/[", "/feed"],
    ["/\n/a b", "/feed"],
    ["/\t/%", "/feed"],
    ["/\r/a:99999999", "/feed"],
    ["/\t/a%00b", "/feed"],
  ])("maps %j to %j", (input, expected) => {
    expect(safeCallbackURL(input)).toBe(expected);
  });
});
