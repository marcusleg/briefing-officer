"use client";

import SkeletonChart from "@/components/frontpage/SkeletonChart";
import { CardHeader } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { TokenUsage } from "@prisma/client";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "../ui/card";

const chartConfig = {
  inputTokens: {
    label: "Input Tokens",
    color: "hsl(var(--chart-1))",
  },
  outputTokens: {
    label: "Output Tokens",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

interface TokenUsageChartProps {
  chartData?: TokenUsage[];
}

const TokenUsageChart = ({ chartData }: TokenUsageChartProps) => {
  const chartTitle = "Token Usage";
  const chartDescription =
    "Daily total of LLM tokens used by your AI Briefing Officer";

  if (!chartData) {
    return <SkeletonChart title={chartTitle} description={chartDescription} />;
  }

  // TODO display cost per model
  const sumInputTokens = chartData
    .map((entry) => entry.inputTokens)
    .reduce((acc, entry) => acc + entry, 0);
  const sumOutputTokens = chartData
    .map((entry) => entry.outputTokens)
    .reduce((acc, entry) => acc + entry, 0);
  const totalCost =
    (sumInputTokens / 1000000) * 0.1 + (sumOutputTokens / 1000000) * 0.4;

  const dateFormatterShort = new Intl.DateTimeFormat(navigator.language, {
    day: "2-digit",
    month: "short",
  });
  const dateFormatterLong = new Intl.DateTimeFormat(navigator.language, {
    dateStyle: "full",
  });

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
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                dateFormatterShort.format(new Date(value))
              }
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
              labelFormatter={(value) =>
                dateFormatterLong.format(new Date(value))
              }
            />
            <Area
              dataKey="inputTokens"
              type="natural"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.4}
              stroke="hsl(var(--chart-1))"
              stackId="a"
            />
            <Area
              dataKey="outputTokens"
              type="natural"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.4}
              stroke="hsl(var(--chart-2))"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-center text-sm font-medium">
        Estimated cost for this period: ${totalCost.toFixed(2)}
      </CardFooter>
    </Card>
  );
};

export default TokenUsageChart;
