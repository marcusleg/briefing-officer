import {
  formatSessionDate,
  lastActiveLabel,
} from "@/app/settings/session-dates";
import { describe, expect, it } from "vitest";

describe("formatSessionDate", () => {
  it("formats a medium date without a time", () => {
    expect(formatSessionDate(new Date(2026, 10, 9, 23, 59))).toBe(
      "Nov 9, 2026",
    );
  });
});

describe("lastActiveLabel", () => {
  const now = new Date(2026, 10, 9, 0, 30);

  it("returns today for the same calendar day", () => {
    expect(lastActiveLabel(new Date(2026, 10, 9, 0, 1), now)).toBe("today");
  });

  it("returns yesterday by calendar day, not 24 hours", () => {
    expect(lastActiveLabel(new Date(2026, 10, 8, 23, 59), now)).toBe(
      "yesterday",
    );
  });

  it("returns the date for older days", () => {
    expect(lastActiveLabel(new Date(2026, 10, 7, 12, 0), now)).toBe(
      "Nov 7, 2026",
    );
  });

  it("handles the year boundary", () => {
    expect(
      lastActiveLabel(
        new Date(2025, 11, 31, 22, 0),
        new Date(2026, 0, 1, 1, 0),
      ),
    ).toBe("yesterday");
  });
});
