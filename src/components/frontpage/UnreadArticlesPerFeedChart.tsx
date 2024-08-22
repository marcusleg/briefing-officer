"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  desktop: {
    label: "Unread articles",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface UnreadArticlesPerFeedChartProps {
  chartData: { feedTitle: string; unread: number }[];
}

const UnreadArticlesPerFeedChart = ({
  chartData,
}: UnreadArticlesPerFeedChartProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Unread articles per feed</CardTitle>
    </CardHeader>
    <CardContent>
      <ChartContainer config={chartConfig}>
        <BarChart accessibilityLayer data={chartData} layout="vertical">
          <XAxis type="number" dataKey="unread" hide />
          <YAxis
            dataKey="feedTitle"
            type="category"
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Bar dataKey="unread" fill="var(--color-desktop)" radius={5} />
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

export default UnreadArticlesPerFeedChart;
