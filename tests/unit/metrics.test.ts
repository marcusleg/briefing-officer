import {
  getMetricsText,
  recordAiLeadGeneration,
  recordAiSummaryGeneration,
  recordArticleScrape,
  recordLanguageModelTokens,
  resetMetricsForTests,
} from "@/lib/metrics";
import { formatGaugeMetrics } from "@/lib/metricsFormatter";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  resetMetricsForTests();
});

describe("runtime metrics", () => {
  it("formats gauge metrics with escaped labels", () => {
    const output = formatGaugeMetrics({
      usersTotal: 1,
      feeds: [{ userId: "user-1", count: 2 }],
      articles: [
        {
          userId: "user-1",
          feedName: 'Tech "Daily"',
          total: 3,
          unread: 2,
          readLater: 1,
          starred: 1,
        },
      ],
    });

    expect(output).toContain("# TYPE briefing_officer_users_total gauge");
    expect(output).toBe(
      [
        "# HELP briefing_officer_users_total Total users.",
        "# TYPE briefing_officer_users_total gauge",
        "briefing_officer_users_total 1",
        "# HELP briefing_officer_feeds_total Total feeds per user.",
        "# TYPE briefing_officer_feeds_total gauge",
        'briefing_officer_feeds_total{user_id="user-1"} 2',
        "# HELP briefing_officer_articles_total Total articles per feed.",
        "# TYPE briefing_officer_articles_total gauge",
        'briefing_officer_articles_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 3',
        "# HELP briefing_officer_articles_unread_total Total unread articles per feed.",
        "# TYPE briefing_officer_articles_unread_total gauge",
        'briefing_officer_articles_unread_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 2',
        "# HELP briefing_officer_articles_read_later_total Total read later articles per feed.",
        "# TYPE briefing_officer_articles_read_later_total gauge",
        'briefing_officer_articles_read_later_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 1',
        "# HELP briefing_officer_articles_starred_total Total starred articles per feed.",
        "# TYPE briefing_officer_articles_starred_total gauge",
        'briefing_officer_articles_starred_total{user_id="user-1",feed_name="Tech \\"Daily\\""} 1',
        "",
      ].join("\n"),
    );
  });

  it("records article scrape counters with success and error labels", async () => {
    recordArticleScrape({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "success",
    });
    recordArticleScrape({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "error",
    });

    const metrics = await getMetricsText();

    expect(metrics).toContain(
      "# TYPE briefing_officer_article_scrapes_total counter",
    );
    expect(metrics).toContain(
      'briefing_officer_article_scrapes_total{user_id="user-1",feed_name="Tech Feed",status="success"} 1',
    );
    expect(metrics).toContain(
      'briefing_officer_article_scrapes_total{user_id="user-1",feed_name="Tech Feed",status="error"} 1',
    );
  });

  it("clears recorded samples when resetting metrics", async () => {
    recordArticleScrape({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "success",
    });

    const beforeReset = await getMetricsText();

    expect(beforeReset).toContain(
      'briefing_officer_article_scrapes_total{user_id="user-1",feed_name="Tech Feed",status="success"} 1',
    );

    resetMetricsForTests();

    const afterReset = await getMetricsText();

    expect(afterReset).not.toContain(
      'briefing_officer_article_scrapes_total{user_id="user-1",feed_name="Tech Feed",status="success"} 1',
    );
  });

  it("records ai generation and token counters", async () => {
    recordAiLeadGeneration({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "success",
    });
    recordAiSummaryGeneration({
      userId: "user-1",
      feedName: "Tech Feed",
      status: "error",
    });
    recordLanguageModelTokens({
      model: "test-model",
      direction: "input",
      tokens: 7,
    });
    recordLanguageModelTokens({
      model: "test-model",
      direction: "output",
      tokens: 3,
    });

    const metrics = await getMetricsText();

    expect(metrics).toContain(
      'briefing_officer_ai_lead_generations_total{user_id="user-1",feed_name="Tech Feed",status="success"} 1',
    );
    expect(metrics).toContain(
      'briefing_officer_ai_summary_generations_total{user_id="user-1",feed_name="Tech Feed",status="error"} 1',
    );
    expect(metrics).toContain(
      'briefing_officer_language_model_tokens_total{model="test-model",direction="input"} 7',
    );
    expect(metrics).toContain(
      'briefing_officer_language_model_tokens_total{model="test-model",direction="output"} 3',
    );
  });
});
