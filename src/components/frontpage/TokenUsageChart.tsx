"use client";

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
  tokenUsage: TokenUsage[];
}

const TokenUsageChart = ({ tokenUsage }: TokenUsageChartProps) => {
  // TODO display cost per model
  const sumInputTokens = tokenUsage
    .map((entry) => entry.inputTokens)
    .reduce((acc, entry) => acc + entry, 0);
  const sumOutputTokens = tokenUsage
    .map((entry) => entry.outputTokens)
    .reduce((acc, entry) => acc + entry, 0);
  const totalCost =
    (sumInputTokens / 1000000) * 0.1 + (sumOutputTokens / 1000000) * 0.4;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Usage</CardTitle>
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
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="inputTokens"
              type="natural"
              fill="var(--color-mobile)"
              fillOpacity={0.4}
              stroke="var(--color-mobile)"
              stackId="a"
            />
            <Area
              dataKey="outputTokens"
              type="natural"
              fill="var(--color-desktop)"
              fillOpacity={0.4}
              stroke="var(--color-desktop)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-center text-sm font-medium">
        Estimated total cost for this period: ${totalCost.toFixed(2)}
      </CardFooter>
    </Card>
  );
};

export default TokenUsageChart;
