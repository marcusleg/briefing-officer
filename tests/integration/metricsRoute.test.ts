import { GET } from "@/app/api/metrics/route";
import { recordArticleScrape, resetMetricsForTests } from "@/lib/metrics";
import { collectGaugeMetrics } from "@/lib/metricsRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../helpers/db";
import { createFeed, createUser } from "../helpers/factories";

vi.mock("@/lib/metricsRepository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/metricsRepository")>();
  return {
    ...actual,
    collectGaugeMetrics: vi.fn(actual.collectGaugeMetrics),
  };
});

beforeEach(async () => {
  resetMetricsForTests();
  delete process.env.METRICS_TOKEN;
  await resetDb();
  const actual = await vi.importActual<
    typeof import("@/lib/metricsRepository")
  >("@/lib/metricsRepository");
  vi.mocked(collectGaugeMetrics).mockImplementation(actual.collectGaugeMetrics);
});

describe("metrics route", () => {
  it("returns 404 when the metrics token is missing", async () => {
    const response = await GET(new Request("http://localhost/api/metrics"));

    expect(response.status).toBe(404);
  });

  it("returns 401 when auth is missing with a metrics token set", async () => {
    process.env.METRICS_TOKEN = "secret-token";

    const response = await GET(new Request("http://localhost/api/metrics"));

    expect(response.status).toBe(401);
  });

  it("returns 401 when auth is wrong with a metrics token set", async () => {
    process.env.METRICS_TOKEN = "secret-token";

    const response = await GET(
      new Request("http://localhost/api/metrics", {
        headers: {
          Authorization: "Bearer wrong-token",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns prometheus metrics for a valid bearer token", async () => {
    process.env.METRICS_TOKEN = "secret-token";

    const user = await createUser();
    const feed = await createFeed({ userId: user.id, title: "Tech Feed" });

    recordArticleScrape({
      userId: user.id,
      feedName: feed.title,
      status: "success",
    });

    const response = await GET(
      new Request("http://localhost/api/metrics", {
        headers: {
          Authorization: "Bearer secret-token",
        },
      }),
    );

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; version=0.0.4; charset=utf-8",
    );
    expect(body).toContain("briefing_officer_users_total 1");
    expect(body).toContain(
      `briefing_officer_feeds_total{user_id="${user.id}"} 1`,
    );
    expect(body).toContain(
      `briefing_officer_article_scrapes_total{user_id="${user.id}",feed_name="Tech Feed",status="success"} 1`,
    );
  });

  it("returns 503 when metrics collection fails", async () => {
    process.env.METRICS_TOKEN = "secret-token";
    vi.mocked(collectGaugeMetrics).mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const response = await GET(
      new Request("http://localhost/api/metrics", {
        headers: {
          Authorization: "Bearer secret-token",
        },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toBe("Service Unavailable");
  });
});
