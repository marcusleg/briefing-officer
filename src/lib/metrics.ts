import { Counter, Registry } from "prom-client";

export type OperationStatus = "success" | "error";
export type TokenDirection = "input" | "output";

type ArticleScrapeEvent = {
  userId: string;
  feedName: string;
  status: OperationStatus;
};

type AiGenerationEvent = ArticleScrapeEvent;

type LanguageModelTokenEvent = {
  model: string;
  direction: TokenDirection;
  tokens: number;
};

let registry: Registry;
let articleScrapesTotal: Counter<string>;
let aiLeadGenerationsTotal: Counter<string>;
let aiSummaryGenerationsTotal: Counter<string>;
let languageModelTokensTotal: Counter<string>;

const createRegistry = () => {
  const nextRegistry = new Registry();

  const nextArticleScrapesTotal = new Counter({
    name: "briefing_officer_article_scrapes_total",
    help: "Total article scrape attempts.",
    labelNames: ["user_id", "feed_name", "status"],
    registers: [nextRegistry],
  });

  const nextAiLeadGenerationsTotal = new Counter({
    name: "briefing_officer_ai_lead_generations_total",
    help: "Total AI lead generation attempts.",
    labelNames: ["user_id", "feed_name", "status"],
    registers: [nextRegistry],
  });

  const nextAiSummaryGenerationsTotal = new Counter({
    name: "briefing_officer_ai_summary_generations_total",
    help: "Total AI summary generation attempts.",
    labelNames: ["user_id", "feed_name", "status"],
    registers: [nextRegistry],
  });

  const nextLanguageModelTokensTotal = new Counter({
    name: "briefing_officer_language_model_tokens_total",
    help: "Total language model tokens.",
    labelNames: ["model", "direction"],
    registers: [nextRegistry],
  });

  registry = nextRegistry;
  articleScrapesTotal = nextArticleScrapesTotal;
  aiLeadGenerationsTotal = nextAiLeadGenerationsTotal;
  aiSummaryGenerationsTotal = nextAiSummaryGenerationsTotal;
  languageModelTokensTotal = nextLanguageModelTokensTotal;
};

createRegistry();

export const resetMetricsForTests = () => {
  createRegistry();
};

export const recordArticleScrape = ({
  userId,
  feedName,
  status,
}: ArticleScrapeEvent) => {
  articleScrapesTotal.inc({
    user_id: userId,
    feed_name: feedName,
    status,
  });
};

export const recordAiLeadGeneration = ({
  userId,
  feedName,
  status,
}: AiGenerationEvent) => {
  aiLeadGenerationsTotal.inc({
    user_id: userId,
    feed_name: feedName,
    status,
  });
};

export const recordAiSummaryGeneration = ({
  userId,
  feedName,
  status,
}: AiGenerationEvent) => {
  aiSummaryGenerationsTotal.inc({
    user_id: userId,
    feed_name: feedName,
    status,
  });
};

export const recordLanguageModelTokens = ({
  model,
  direction,
  tokens,
}: LanguageModelTokenEvent) => {
  if (tokens <= 0) {
    return;
  }

  languageModelTokensTotal.inc(
    {
      model,
      direction,
    },
    tokens,
  );
};

export const getMetricsText = async () => registry.metrics();
