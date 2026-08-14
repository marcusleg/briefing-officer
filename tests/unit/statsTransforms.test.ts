import { ArticleStatus, TokenUsage } from "@/generated/prisma/client";
import {
  computeDailyAverage,
  shapeArticlesPerFeedPerDay,
  shapeRejectedArticlesPerDay,
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

describe("computeDailyAverage", () => {
  it("returns 0 for empty input", () => {
    expect(computeDailyAverage([])).toBe(0);
  });

  it("divides total count by the number of rows", () => {
    expect(
      computeDailyAverage([
        { date: "d1", count: 4 },
        { date: "d2", count: 6 },
      ]),
    ).toBe(5);
  });
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

describe("shapeRejectedArticlesPerDay", () => {
  const rejected = (status: ArticleStatus, iso: string) => ({
    status,
    statusChangedAt: new Date(iso),
  });

  it("returns a zeroed row for every day, even without any articles", () => {
    expect(
      shapeRejectedArticlesPerDay(["2026-03-01", "2026-03-02"], []),
    ).toEqual([
      { date: "2026-03-01", filtered: 0, notInterested: 0 },
      { date: "2026-03-02", filtered: 0, notInterested: 0 },
    ]);
  });

  it("counts the two rejection sources separately", () => {
    const rows = shapeRejectedArticlesPerDay(
      ["2026-03-01"],
      [
        rejected("FILTERED", "2026-03-01T08:00:00.000Z"),
        rejected("FILTERED", "2026-03-01T20:00:00.000Z"),
        rejected("NOT_INTERESTED", "2026-03-01T12:00:00.000Z"),
      ],
    );

    expect(rows).toEqual([
      { date: "2026-03-01", filtered: 2, notInterested: 1 },
    ]);
  });

  it("keeps days without activity in place between busy ones", () => {
    const rows = shapeRejectedArticlesPerDay(
      ["2026-03-01", "2026-03-02", "2026-03-03"],
      [
        rejected("FILTERED", "2026-03-01T08:00:00.000Z"),
        rejected("NOT_INTERESTED", "2026-03-03T08:00:00.000Z"),
      ],
    );

    expect(rows).toEqual([
      { date: "2026-03-01", filtered: 1, notInterested: 0 },
      { date: "2026-03-02", filtered: 0, notInterested: 0 },
      { date: "2026-03-03", filtered: 0, notInterested: 1 },
    ]);
  });

  it("ignores articles whose day falls outside the range", () => {
    const rows = shapeRejectedArticlesPerDay(
      ["2026-03-02"],
      [
        rejected("FILTERED", "2026-03-01T23:59:59.000Z"),
        rejected("FILTERED", "2026-03-02T00:00:00.000Z"),
        rejected("FILTERED", "2026-03-03T00:00:00.000Z"),
      ],
    );

    expect(rows).toEqual([
      { date: "2026-03-02", filtered: 1, notInterested: 0 },
    ]);
  });

  it("counts neither read nor unread articles as rejected", () => {
    const rows = shapeRejectedArticlesPerDay(
      ["2026-03-01"],
      [
        rejected("READ", "2026-03-01T08:00:00.000Z"),
        rejected("UNREAD", "2026-03-01T09:00:00.000Z"),
        rejected("READ_LATER", "2026-03-01T10:00:00.000Z"),
      ],
    );

    expect(rows).toEqual([
      { date: "2026-03-01", filtered: 0, notInterested: 0 },
    ]);
  });

  it("buckets by UTC day, not by the host timezone", () => {
    const rows = shapeRejectedArticlesPerDay(
      ["2026-03-01", "2026-03-02"],
      [rejected("FILTERED", "2026-03-01T23:30:00.000Z")],
    );

    expect(rows).toEqual([
      { date: "2026-03-01", filtered: 1, notInterested: 0 },
      { date: "2026-03-02", filtered: 0, notInterested: 0 },
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
