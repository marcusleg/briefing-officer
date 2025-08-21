"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import SkeletonChart from "@/app/feed/skeleton-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Build dynamic chart config for feeds
const getChartConfigForFeeds = (feeds: string[]): ChartConfig => {
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--chart-7)",
    "var(--chart-8)",
  ];
  const config: Record<string, { label: string; color: string }> = {};
  feeds.forEach((feed, i) => {
    config[feed] = { label: feed, color: colors[i % colors.length] };
  });
  return config;
};

export type NumberOfArticlesLast7DaysChartData = Record<
  string,
  number | string
>;

interface NumberOfArticlesLast7DaysChartProps {
  chartData?: NumberOfArticlesLast7DaysChartData[];
}

const DailyNewArticlesChart = ({
  chartData,
}: NumberOfArticlesLast7DaysChartProps) => {
  const chartTitle = "Daily New Articles";
  const chartDescription =
    "Number of new articles that appeared in your feed each day";

  if (!chartData) {
    return <SkeletonChart title={chartTitle} description={chartDescription} />;
  }

  const dateFormatterShort = new Intl.DateTimeFormat(navigator.language, {
    day: "2-digit",
    month: "short",
  });
  const dateFormatterLong = new Intl.DateTimeFormat(navigator.language, {
    dateStyle: "full",
  });

  // Determine all feed keys dynamically (exclude the 'date' field)
  const feedKeys = Array.from(
    chartData.reduce((set, item) => {
      Object.keys(item).forEach((k) => {
        if (k !== "date") set.add(k);
      });
      return set;
    }, new Set<string>()),
  );

  const chartConfigForFeeds = getChartConfigForFeeds(feedKeys);

  // Compute average total articles per day across all feeds
  const totalAcrossDays = chartData.reduce((sum, day) => {
    const dayTotal = feedKeys.reduce((s, k) => {
      const v = day[k];
      return s + (typeof v === "number" ? v : 0);
    }, 0);
    return sum + dayTotal;
  }, 0);
  const dailyAverage = chartData.length
    ? totalAcrossDays / chartData.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{chartTitle}</CardTitle>
        <CardDescription>{chartDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfigForFeeds}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                dateFormatterShort.format(new Date(value))
              }
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
              labelFormatter={(value) =>
                dateFormatterLong.format(new Date(value))
              }
            />
            {feedKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                fill={chartConfigForFeeds[key]?.color}
                stroke={chartConfigForFeeds[key]?.color}
                stackId="a"
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-center text-sm font-medium">
        {dailyAverage.toFixed(2)} articles per day
      </CardFooter>
    </Card>
  );
};

export default DailyNewArticlesChart;
