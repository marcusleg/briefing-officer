import { TokenUsage } from "@/generated/prisma/client";
import {
  shapeArticlesPerFeedPerDay,
  shapeStatusChangesPerFeedPerDay,
  shapeTokenUsage,
  type ArticlesPerFeedRow,
} from "@/lib/repository/statsTransforms";
import { describe, expect, it } from "vitest";

const tu = (
  date: string,
  model: string,
  input: number,
  output: number,
): TokenUsage => ({
  userId: "u",
  date,
  model,
  inputTokens: input,
  outputTokens: output,
});

describe("shapeArticlesPerFeedPerDay", () => {
  it("returns empty result for empty input", () => {
    expect(shapeArticlesPerFeedPerDay([])).toEqual({
      rows: [],
      feedKeys: [],
      dailyAverage: 0,
    });
  });

  it("collects feed keys across rows, excluding 'date'", () => {
    const rows: ArticlesPerFeedRow[] = [
      { date: "d1", FeedA: 2, FeedB: 3 },
      { date: "d2", FeedA: 1, FeedC: 4 },
    ];
    const result = shapeArticlesPerFeedPerDay(rows);
    expect(new Set(result.feedKeys)).toEqual(
      new Set(["FeedA", "FeedB", "FeedC"]),
    );
    expect(result.rows).toBe(rows);
  });

  it("computes dailyAverage from numeric feed values only", () => {
    const rows: ArticlesPerFeedRow[] = [
      { date: "d1", FeedA: 2, FeedB: 3 },
      { date: "d2", FeedA: 5 },
    ];
    expect(shapeArticlesPerFeedPerDay(rows).dailyAverage).toBe(5);
  });
});

describe("shapeStatusChangesPerFeedPerDay", () => {
  // The callers (getWeeklyArticlesRead, getFilteredArticlesPerDay) already
  // constrain their query to a single status, so there is no status field left
  // to check here.
  const feedTitles = new Map([
    [1, "Feed A"],
    [2, "Feed B"],
  ]);
  const change = (iso: string, feedId = 1) => ({
    feedId,
    statusChangedAt: new Date(iso),
  });

  it("returns a bare row for every day, even without any articles", () => {
    expect(
      shapeStatusChangesPerFeedPerDay(
        ["2026-03-01", "2026-03-02"],
        [],
        feedTitles,
      ),
    ).toEqual({
      rows: [{ date: "2026-03-01" }, { date: "2026-03-02" }],
      feedKeys: [],
      dailyAverage: 0,
    });
  });

  it("counts the day's articles under the title of their feed", () => {
    const { rows, feedKeys, dailyAverage } = shapeStatusChangesPerFeedPerDay(
      ["2026-03-01"],
      [
        change("2026-03-01T08:00:00.000Z", 1),
        change("2026-03-01T20:00:00.000Z", 2),
        change("2026-03-01T12:00:00.000Z", 1),
      ],
      feedTitles,
    );

    expect(rows).toEqual([{ date: "2026-03-01", "Feed A": 2, "Feed B": 1 }]);
    expect(new Set(feedKeys)).toEqual(new Set(["Feed A", "Feed B"]));
    expect(dailyAverage).toBe(3);
  });

  it("keeps days without activity in place between busy ones", () => {
    const { rows, dailyAverage } = shapeStatusChangesPerFeedPerDay(
      ["2026-03-01", "2026-03-02", "2026-03-03"],
      [
        change("2026-03-01T08:00:00.000Z", 1),
        change("2026-03-03T08:00:00.000Z", 2),
      ],
      feedTitles,
    );

    expect(rows).toEqual([
      { date: "2026-03-01", "Feed A": 1 },
      { date: "2026-03-02" },
      { date: "2026-03-03", "Feed B": 1 },
    ]);
    expect(dailyAverage).toBeCloseTo(2 / 3);
  });

  it("ignores articles whose day falls outside the range", () => {
    const { rows } = shapeStatusChangesPerFeedPerDay(
      ["2026-03-02"],
      [
        change("2026-03-01T23:59:59.000Z"),
        change("2026-03-02T00:00:00.000Z"),
        change("2026-03-03T00:00:00.000Z"),
      ],
      feedTitles,
    );

    expect(rows).toEqual([{ date: "2026-03-02", "Feed A": 1 }]);
  });

  it("drops articles of a feed without a known title", () => {
    const { rows, feedKeys } = shapeStatusChangesPerFeedPerDay(
      ["2026-03-01"],
      [change("2026-03-01T08:00:00.000Z", 99)],
      feedTitles,
    );

    expect(rows).toEqual([{ date: "2026-03-01" }]);
    expect(feedKeys).toEqual([]);
  });

  it("buckets by UTC day, not by the host timezone", () => {
    const { rows } = shapeStatusChangesPerFeedPerDay(
      ["2026-03-01", "2026-03-02"],
      [change("2026-03-01T23:30:00.000Z")],
      feedTitles,
    );

    expect(rows).toEqual([
      { date: "2026-03-01", "Feed A": 1 },
      { date: "2026-03-02" },
    ]);
  });
});

describe("shapeTokenUsage", () => {
  it("returns empty result for empty input", () => {
    expect(shapeTokenUsage([])).toEqual({ rows: [], models: [] });
  });

  it("collapses multiple models on the same date into one row", () => {
    const result = shapeTokenUsage([
      tu("d1", "modelA", 10, 20),
      tu("d1", "modelB", 30, 40),
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toStrictEqual({
      date: "d1",
      modelA_input: 10,
      modelA_output: 20,
      modelB_input: 30,
      modelB_output: 40,
    });
    expect(new Set(result.models)).toEqual(new Set(["modelA", "modelB"]));
  });

  it("creates one row per distinct date", () => {
    const result = shapeTokenUsage([tu("d1", "m", 1, 2), tu("d2", "m", 3, 4)]);
    expect(result.rows.map((r) => r.date)).toEqual(["d1", "d2"]);
    expect(result.models).toEqual(["m"]);
  });
});
