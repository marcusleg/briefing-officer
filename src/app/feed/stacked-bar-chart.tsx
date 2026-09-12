"use client";

import { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";

export type StackedBarRow = Record<string, string | number>;

/** The stacked series of one chart: a row per day, and the keys to stack. */
export interface StackedBarData {
  rows: StackedBarRow[];
  keys: string[];
}

interface StackedBarChartProps {
  title: string;
  description: string;
  /** A label and a color per key. Callers build their own, so that charts
   *  sharing a series — the same feed in two of them — can share one map. */
  config: ChartConfig;
  data?: StackedBarData;
  footer?: ReactNode;
}

/**
 * One bar per day, stacked by whatever the caller keys its rows on. Shared by
 * every daily chart on the dashboard — they differ only in their copy, their
 * series and their config.
 */
const StackedBarChart = ({
  title,
  description,
  config,
  data,
  footer,
}: StackedBarChartProps) => {
  const { short, long } = useDateFormatters();

  return (
    <ChartCard
      title={title}
      description={description}
      config={config}
      data={data}
      footer={footer}
    >
      <BarChart
        accessibilityLayer
        data={data?.rows}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => short.format(new Date(value))}
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(value) => long.format(new Date(String(value)))}
        />
        {(data?.keys ?? []).map((key) => (
          <Bar
            key={key}
            dataKey={key}
            fill={config[key]?.color}
            stroke={config[key]?.color}
            stackId="a"
          />
        ))}
      </BarChart>
    </ChartCard>
  );
};

export default StackedBarChart;
