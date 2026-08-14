"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDateFormatters } from "@/hooks/use-date-formatters";
import { RejectedArticlesRow } from "@/lib/repository/statsTransforms";

const chartConfig = {
  filtered: { label: "Filtered", color: "var(--chart-2)" },
  notInterested: { label: "Not interested", color: "var(--chart-4)" },
} satisfies ChartConfig;

export interface DailyFilteredArticlesData {
  rows: RejectedArticlesRow[];
  dailyAverage: number;
}

interface DailyFilteredArticlesChartProps {
  data?: DailyFilteredArticlesData;
}

const DailyFilteredArticlesChart = ({
  data,
}: DailyFilteredArticlesChartProps) => {
  const { short, long } = useDateFormatters();

  return (
    <ChartCard
      title="Filtered Articles"
      description="Number of articles that never reached you each day, by your interest profile or your own hand"
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
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(value) => long.format(new Date(String(value)))}
        />
        <Bar dataKey="filtered" fill={chartConfig.filtered.color} stackId="a" />
        <Bar
          dataKey="notInterested"
          fill={chartConfig.notInterested.color}
          stackId="a"
        />
      </BarChart>
    </ChartCard>
  );
};

export default DailyFilteredArticlesChart;
