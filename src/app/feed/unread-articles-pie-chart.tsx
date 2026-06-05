"use client";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CHART_COLORS } from "@/lib/charts/palette";
import { Cell, Label, Pie, PieChart } from "recharts";

const chartConfig: ChartConfig = {
  feedTitle: { label: "Feed" },
};

export interface UnreadArticlesChartData {
  feedTitle: string;
  unread: number;
}

interface UnreadArticlesChartProps {
  chartData?: UnreadArticlesChartData[];
}

const UnreadArticlesPieChart = ({ chartData }: UnreadArticlesChartProps) => {
  const unreadArticlesInTotal = (chartData ?? []).reduce(
    (acc, feed) => acc + feed.unread,
    0,
  );

  return (
    <ChartCard
      title="Articles to Explore"
      description="Articles you haven’t dismissed or read yet"
      config={chartConfig}
      data={chartData}
      containerClassName="mx-auto aspect-square max-h-[250px]"
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
          {(chartData ?? []).map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
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
    </ChartCard>
  );
};

export default UnreadArticlesPieChart;
