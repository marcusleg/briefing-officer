export type GaugeMetrics = {
  usersTotal: number;
  feeds: Array<{
    userId: string;
    count: number;
  }>;
  articles: Array<{
    userId: string;
    feedName: string;
    total: number;
    unread: number;
    readLater: number;
    starred: number;
  }>;
};

type GaugeDefinition = {
  help: string;
  name: string;
  rows: string[];
};

const escapeLabelValue = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');

const formatLabels = (labels: Record<string, string>) => {
  const entries = Object.entries(labels);

  if (entries.length === 0) {
    return "";
  }

  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",")}}`;
};

const formatGauge = ({ help, name, rows }: GaugeDefinition) =>
  [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, ...rows].join("\n");

export const formatGaugeMetrics = (metrics: GaugeMetrics) => {
  const sections = [
    formatGauge({
      help: "Total users.",
      name: "briefing_officer_users_total",
      rows: [`briefing_officer_users_total ${metrics.usersTotal}`],
    }),
    formatGauge({
      help: "Total feeds per user.",
      name: "briefing_officer_feeds_total",
      rows: metrics.feeds.map(
        ({ userId, count }) =>
          `briefing_officer_feeds_total${formatLabels({ user_id: userId })} ${count}`,
      ),
    }),
    formatGauge({
      help: "Total articles per feed.",
      name: "briefing_officer_articles_total",
      rows: metrics.articles.map(
        ({ userId, feedName, total }) =>
          `briefing_officer_articles_total${formatLabels({ user_id: userId, feed_name: feedName })} ${total}`,
      ),
    }),
    formatGauge({
      help: "Total unread articles per feed.",
      name: "briefing_officer_articles_unread_total",
      rows: metrics.articles.map(
        ({ userId, feedName, unread }) =>
          `briefing_officer_articles_unread_total${formatLabels({ user_id: userId, feed_name: feedName })} ${unread}`,
      ),
    }),
    formatGauge({
      help: "Total read later articles per feed.",
      name: "briefing_officer_articles_read_later_total",
      rows: metrics.articles.map(
        ({ userId, feedName, readLater }) =>
          `briefing_officer_articles_read_later_total${formatLabels({ user_id: userId, feed_name: feedName })} ${readLater}`,
      ),
    }),
    formatGauge({
      help: "Total starred articles per feed.",
      name: "briefing_officer_articles_starred_total",
      rows: metrics.articles.map(
        ({ userId, feedName, starred }) =>
          `briefing_officer_articles_starred_total${formatLabels({ user_id: userId, feed_name: feedName })} ${starred}`,
      ),
    }),
  ];

  return `${sections.join("\n")}\n`;
};
