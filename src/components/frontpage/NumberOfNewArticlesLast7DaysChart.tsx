"use client";

import { Bar, BarChart, CartesianGrid, Rectangle, XAxis } from "recharts";

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

interface NumberOfArticlesLast7DaysChartProps {
  chartData: { date: string; weekday: string; count: number }[];
}

const NumberOfNewArticlesLast7DaysChart = ({
  chartData,
}: NumberOfArticlesLast7DaysChartProps) => {
  const dailyAverage = chartData.reduce((acc, day) => acc + day.count, 0) / 7;

  const from = chartData[0].date;
  const to = chartData[6].date;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New articles per day</CardTitle>
        <CardDescription>
          {from} to {to}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="weekday"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="count"
              fill="hsl(var(--chart-1))"
              strokeWidth={2}
              radius={8}
              activeBar={({ ...props }) => {
                return (
                  <Rectangle
                    {...props}
                    fillOpacity={0.8}
                    stroke={props.payload.fill}
                    strokeDasharray={4}
                    strokeDashoffset={4}
                  />
                );
              }}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-center text-sm font-medium">
        {dailyAverage.toFixed(2)} articles per day
      </CardFooter>
    </Card>
  );
};

export default NumberOfNewArticlesLast7DaysChart;
