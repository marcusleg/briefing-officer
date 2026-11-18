"use client";

import StackedBarChart, { StackedBarRow } from "@/app/feed/stacked-bar-chart";
import { ChartConfig } from "@/components/ui/chart";
import { CHART_COLORS } from "@/lib/charts/palette";

export interface TokenUsageData {
  rows: StackedBarRow[];
  models: string[];
  dailyAverage: { input: number; output: number };
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "913", "8.2K": whole tokens, kept short enough for a footer in one line. */
const tokenCount = (tokens: number) => compact.format(Math.round(tokens));

interface TokenUsageChartProps {
  data?: TokenUsageData;
}

/** The two series a model contributes, input below output in the stack. */
const seriesOf = (model: string) => [`${model}_input`, `${model}_output`];

/**
 * Every model's input series first, then every model's output series, so the
 * two halves of the stack stay visually distinct once there are several models.
 */
const buildModelTokenConfig = (models: string[]): ChartConfig => {
  const config: Record<string, { label: string; color: string }> = {};
  models.forEach((model, index) => {
    const [input, output] = seriesOf(model);
    config[input] = {
      label: `${model} Input`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    config[output] = {
      label: `${model} Output`,
      color: CHART_COLORS[(index + models.length) % CHART_COLORS.length],
    };
  });
  return config;
};

const TokenUsageChart = ({ data }: TokenUsageChartProps) => (
  <StackedBarChart
    title="Token Usage"
    description="Daily total of LLM tokens used by your AI Briefing Officer"
    config={buildModelTokenConfig(data?.models ?? [])}
    data={data && { rows: data.rows, keys: data.models.flatMap(seriesOf) }}
    footer={
      data &&
      `${tokenCount(data.dailyAverage.input)} in · ${tokenCount(data.dailyAverage.output)} out per day`
    }
  />
);

export default TokenUsageChart;
