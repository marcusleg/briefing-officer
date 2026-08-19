import { TokenUsage } from "@/generated/prisma/client";
import {
  shapeArticlesPerFeedPerDay,
  shapeTokenUsage,
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
  const feedTitles = new Map([
    [1, "Feed A"],
    [2, "Feed B"],
  ]);
  const article = (iso: string, feedId = 1) => ({
    feedId,
    at: new Date(iso),
  });

  it("returns an empty result when the range holds no days", () => {
    expect(shapeArticlesPerFeedPerDay([], [], feedTitles)).toEqual({
      rows: [],
      feedKeys: [],
      dailyAverage: 0,
    });
  });

  it("returns a bare row for every day, even without any articles", () => {
    expect(
      shapeArticlesPerFeedPerDay(["2026-03-01", "2026-03-02"], [], feedTitles),
    ).toEqual({
      rows: [{ date: "2026-03-01" }, { date: "2026-03-02" }],
      feedKeys: [],
      dailyAverage: 0,
    });
  });

  it("counts the day's articles under the title of their feed", () => {
    const { rows, feedKeys, dailyAverage } = shapeArticlesPerFeedPerDay(
      ["2026-03-01"],
      [
        article("2026-03-01T08:00:00.000Z", 1),
        article("2026-03-01T20:00:00.000Z", 2),
        article("2026-03-01T12:00:00.000Z", 1),
      ],
      feedTitles,
    );

    expect(rows).toEqual([{ date: "2026-03-01", "Feed A": 2, "Feed B": 1 }]);
    expect(new Set(feedKeys)).toEqual(new Set(["Feed A", "Feed B"]));
    expect(dailyAverage).toBe(3);
  });

  it("keeps days without activity in place between busy ones", () => {
    const { rows, dailyAverage } = shapeArticlesPerFeedPerDay(
      ["2026-03-01", "2026-03-02", "2026-03-03"],
      [
        article("2026-03-01T08:00:00.000Z", 1),
        article("2026-03-03T08:00:00.000Z", 2),
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
    const { rows } = shapeArticlesPerFeedPerDay(
      ["2026-03-02"],
      [
        article("2026-03-01T23:59:59.000Z"),
        article("2026-03-02T00:00:00.000Z"),
        article("2026-03-03T00:00:00.000Z"),
      ],
      feedTitles,
    );

    expect(rows).toEqual([{ date: "2026-03-02", "Feed A": 1 }]);
  });

  it("drops articles of a feed without a known title", () => {
    const { rows, feedKeys } = shapeArticlesPerFeedPerDay(
      ["2026-03-01"],
      [article("2026-03-01T08:00:00.000Z", 99)],
      feedTitles,
    );

    expect(rows).toEqual([{ date: "2026-03-01" }]);
    expect(feedKeys).toEqual([]);
  });

  it("buckets by UTC day, not by the host timezone", () => {
    const { rows } = shapeArticlesPerFeedPerDay(
      ["2026-03-01", "2026-03-02"],
      [article("2026-03-01T23:30:00.000Z")],
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
