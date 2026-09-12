"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";
import { ArticlesPerFeedData } from "@/lib/repository/statsTransforms";

interface StackedFeedBarChartProps {
  title: string;
  description: string;
  /** The dashboard's feed-to-color map. Passed in rather than derived here, so
   *  that a feed reads as the same color in every chart of the row. */
  config: ChartConfig;
  data?: ArticlesPerFeedData;
}

/**
 * One bar per day, stacked by the feed each article came from. Shared by every
 * daily article count on the dashboard — they differ only in their copy.
 */
const StackedFeedBarChart = ({
  title,
  description,
  config,
  data,
}: StackedFeedBarChartProps) => {
  const { short, long } = useDateFormatters();

  return (
    <ChartCard
      title={title}
      description={description}
      config={config}
      data={data}
      footer={data && `${data.dailyAverage.toFixed(2)} articles per day`}
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
        {(data?.feedKeys ?? []).map((key) => (
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

export default StackedFeedBarChart;
