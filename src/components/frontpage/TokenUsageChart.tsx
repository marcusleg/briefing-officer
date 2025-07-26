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
  tokenUsage?: TokenUsage[];
}

const TokenUsageChart = ({ tokenUsage }: TokenUsageChartProps) => {
  const chartTitle = "Token Usage";

  if (!tokenUsage) {
    return <SkeletonChart title={chartTitle} />;
  }

  // TODO display cost per model
  const sumInputTokens = tokenUsage
    .map((entry) => entry.inputTokens)
    .reduce((acc, entry) => acc + entry, 0);
  const sumOutputTokens = tokenUsage
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
        <CardDescription>LLM token consumption (stacked)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={tokenUsage}
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
