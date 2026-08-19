"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";
import { buildPalette } from "@/lib/charts/palette";
import { ArticlesPerFeedRow } from "@/lib/repository/statsTransforms";

export interface DailyActivityData {
  rows: ArticlesPerFeedRow[];
  feedKeys: string[];
  dailyAverage: number;
}

interface DailyActivityChartProps {
  data?: DailyActivityData;
}

const DailyActivityChart = ({ data }: DailyActivityChartProps) => {
  const { short, long } = useDateFormatters();
  const config = buildPalette(data?.feedKeys ?? []);

  return (
    <ChartCard
      title="Your Daily Activity"
      description="Number of articles you read each day, split by the feed they came from"
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

export default DailyActivityChart;
