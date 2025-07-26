"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import SkeletonChart from "@/components/frontpage/SkeletonChart";
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

export interface NumberOfArticlesReadLast7DaysChartData {
  date: string;
  count: number;
}

interface NumberOfArticlesReadLast7DaysChartProps {
  chartData?: NumberOfArticlesReadLast7DaysChartData[];
}

const ArticlesReadPerDayChart = ({
  chartData,
}: NumberOfArticlesReadLast7DaysChartProps) => {
  const chartTitle = "Daily Reads";
  const chartDescription = "Number of articles you read per day";

  if (!chartData) {
    return <SkeletonChart title={chartTitle} description={chartDescription} />;
  }

  const dateFormatterShort = new Intl.DateTimeFormat(navigator.language, {
    day: "2-digit",
    month: "short",
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
          <AreaChart
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
              content={<ChartTooltipContent hideLabel />}
            />
            <Area
              dataKey="count"
              type="natural"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.4}
              stroke="hsl(var(--chart-1))"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-center text-sm font-medium">
        {dailyAverage.toFixed(2)} articles per day
      </CardFooter>
    </Card>
  );
};

export default ArticlesReadPerDayChart;
