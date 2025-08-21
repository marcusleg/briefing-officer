"use client";

import SkeletonChart from "@/app/feed/skeleton-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Cell, Label, Pie, PieChart } from "recharts";

const chartConfig = {
  feedTitle: {
    label: "Feed",
  },
} satisfies ChartConfig;

const pieChartCellColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface UnreadArticlesChartData {
  feedTitle: string;
  unread: number;
}

interface UnreadArticlesChartProps {
  chartData?: UnreadArticlesChartData[];
}

const UnreadArticlesPieChart = ({ chartData }: UnreadArticlesChartProps) => {
  const chartTitle = "Articles to Explore";
  const chartDescription = "Articles you haven’t dismissed or read yet";

  if (!chartData) {
    return <SkeletonChart title={chartTitle} description={chartDescription} />;
  }

  const unreadArticlesInTotal = chartData.reduce(
    (acc, feed) => acc + feed.unread,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{chartTitle}</CardTitle>
        <CardDescription>{chartDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="unread"
              nameKey="feedTitle"
              innerRadius={60}
              strokeWidth={5}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={pieChartCellColors[index % pieChartCellColors.length]}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {unreadArticlesInTotal}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default UnreadArticlesPieChart;
