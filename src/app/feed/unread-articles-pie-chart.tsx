"use client";

import ChartCard from "@/app/feed/chart-card";
import {
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { feedKey } from "@/lib/repository/statsTransforms";
import { Cell, Label, Pie, PieChart } from "recharts";

export interface UnreadArticlesChartData {
  feedId: number;
  feedTitle: string;
  unread: number;
}

interface UnreadArticlesChartProps {
  /** The dashboard's feed-to-color map, shared with the bar charts so a feed
   *  reads as the same color across the row. */
  config: ChartConfig;
  chartData?: UnreadArticlesChartData[];
}

const UnreadArticlesPieChart = ({
  config,
  chartData,
}: UnreadArticlesChartProps) => {
  const unreadArticlesInTotal = (chartData ?? []).reduce(
    (acc, feed) => acc + feed.unread,
    0,
  );

  // `nameKey` points recharts at the field holding the config key, which is how
  // each slice finds its label and its color.
  const slices = (chartData ?? []).map(({ feedId, unread }) => ({
    feed: feedKey(feedId),
    unread,
  }));

  return (
    <ChartCard
      title="Articles to Explore"
      description="Articles you haven’t dismissed or read yet"
      config={config}
      data={chartData}
      containerClassName="mx-auto aspect-square max-h-[250px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={slices}
          dataKey="unread"
          nameKey="feed"
          innerRadius="50%"
          strokeWidth={5}
        >
          {slices.map((slice) => (
            <Cell key={slice.feed} fill={config[slice.feed]?.color} />
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
