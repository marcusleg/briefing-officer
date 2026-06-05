"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import { ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";
import { CHART_COLORS } from "@/lib/charts/palette";
import { TokenUsageRow } from "@/lib/repository/statsTransforms";

export interface TokenUsageData {
  rows: TokenUsageRow[];
  models: string[];
  totalCost: number;
}

interface TokenUsageChartProps {
  data?: TokenUsageData;
}

const buildModelTokenConfig = (models: string[]): ChartConfig => {
  const config: Record<string, { label: string; color: string }> = {};
  models.forEach((model, index) => {
    config[`${model}_input`] = {
      label: `${model} Input`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    config[`${model}_output`] = {
      label: `${model} Output`,
      color: CHART_COLORS[(index + models.length) % CHART_COLORS.length],
    };
    config[`${model}_reasoning`] = {
      label: `${model} Reasoning`,
      color: CHART_COLORS[(index + 2 * models.length) % CHART_COLORS.length],
    };
  });
  return config;
};

const TokenUsageChart = ({ data }: TokenUsageChartProps) => {
  const { short, long } = useDateFormatters();
  const config = buildModelTokenConfig(data?.models ?? []);

  return (
    <ChartCard
      title="Token Usage"
      description="Daily total of LLM tokens used by your AI Briefing Officer"
      config={config}
      data={data}
      footer={data && `$${data.totalCost.toFixed(2)} estimated cost for this period`}
    >
      <BarChart
        accessibilityLayer
        data={data?.rows}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => short.format(new Date(value))}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(value) => long.format(new Date(value))}
        />
        {(data?.models ?? []).flatMap((model) => [
          <Bar
            key={`${model}_input`}
            dataKey={`${model}_input`}
            fill={config[`${model}_input`].color}
            stackId="a"
          />,
          <Bar
            key={`${model}_output`}
            dataKey={`${model}_output`}
            fill={config[`${model}_output`].color}
            stackId="a"
          />,
          <Bar
            key={`${model}_reasoning`}
            dataKey={`${model}_reasoning`}
            fill={config[`${model}_reasoning`].color}
            stackId="a"
          />,
        ])}
      </BarChart>
    </ChartCard>
  );
};

export default TokenUsageChart;
