import { backoffMs, feedRefreshIntervalMs } from "@/lib/jobs/config";
import { afterEach, describe, expect, it } from "vitest";

describe("backoffMs", () => {
  it("doubles from one minute per previous failure", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(4)).toBe(480_000);
  });
});

describe("feedRefreshIntervalMs", () => {
  const original = process.env.FEED_REFRESH_INTERVAL_MINUTES;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.FEED_REFRESH_INTERVAL_MINUTES;
    } else {
      process.env.FEED_REFRESH_INTERVAL_MINUTES = original;
    }
  });

  it("defaults to 15 minutes", () => {
    delete process.env.FEED_REFRESH_INTERVAL_MINUTES;
    expect(feedRefreshIntervalMs()).toBe(15 * 60_000);
  });

  it("reads the environment variable in minutes", () => {
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "5";
    expect(feedRefreshIntervalMs()).toBe(5 * 60_000);
  });

  it("falls back to the default for unusable values", () => {
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "soon";
    expect(feedRefreshIntervalMs()).toBe(15 * 60_000);
    process.env.FEED_REFRESH_INTERVAL_MINUTES = "0";
    expect(feedRefreshIntervalMs()).toBe(15 * 60_000);
  });
});
