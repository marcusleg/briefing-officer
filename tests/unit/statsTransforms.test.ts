import { TokenUsage } from "@/generated/prisma/client";
import {
  computeDailyAverage,
  shapeArticlesPerFeedPerDay,
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
