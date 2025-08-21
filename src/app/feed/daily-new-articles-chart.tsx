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

const chartConfig = {
  count: {
    label: "Articles",
  },
} satisfies ChartConfig;

export interface NumberOfArticlesLast7DaysChartData {
  date: string;
  count: number;
}

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

  const dailyAverage = chartData.reduce((acc, day) => acc + day.count, 0) / 7;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{chartTitle}</CardTitle>
        <CardDescription>{chartDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
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
              content={<ChartTooltipContent />}
              labelFormatter={(value) =>
                dateFormatterLong.format(new Date(value))
              }
            />
            <Bar dataKey="count" fill="var(--chart-1)" stackId="a" />
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
