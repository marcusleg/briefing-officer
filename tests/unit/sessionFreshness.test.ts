import { isSessionNotFresh } from "@/app/settings/session-freshness";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

describe("isSessionNotFresh", () => {
  it("is true for Better Auth's SESSION_NOT_FRESH error", () => {
    const error = new APIError("FORBIDDEN", {
      code: "SESSION_NOT_FRESH",
      message: "Session is not fresh",
    });

    expect(isSessionNotFresh(error)).toBe(true);
  });

  it("is false for other API errors", () => {
    const error = new APIError("UNAUTHORIZED", {
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });

    expect(isSessionNotFresh(error)).toBe(false);
  });

  it("is false for other values", () => {
    expect(isSessionNotFresh(new Error("x"))).toBe(false);
    expect(isSessionNotFresh(undefined)).toBe(false);
  });
});
