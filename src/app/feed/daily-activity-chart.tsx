"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";

const chartConfig = {
  count: { label: "Articles" },
} satisfies ChartConfig;

export interface DailyActivityData {
  rows: Array<{ date: string; count: number }>;
  dailyAverage: number;
}

interface DailyActivityChartProps {
  data?: DailyActivityData;
}

const DailyActivityChart = ({ data }: DailyActivityChartProps) => {
  const { short, long } = useDateFormatters();

  return (
    <ChartCard
      title="Your Daily Activity"
      description="Number of articles you interacted with each day"
      config={chartConfig}
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
          content={<ChartTooltipContent />}
          labelFormatter={(value) => long.format(new Date(value))}
        />
        <Bar dataKey="count" fill="var(--chart-1)" stackId="a" />
      </BarChart>
    </ChartCard>
  );
};

export default DailyActivityChart;
