"use client";

import StackedBarChart, { StackedBarRow } from "@/app/feed/stacked-bar-chart";
import { ChartConfig } from "@/components/ui/chart";
import { CHART_COLORS } from "@/lib/charts/palette";

export interface TokenUsageData {
  rows: StackedBarRow[];
  models: string[];
}

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
  />
);

export default TokenUsageChart;
