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

// Dynamic chart config will be generated based on available models
const getChartConfig = (models: string[]): ChartConfig => {
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
  ];

  const config: Record<string, { label: string; color: string }> = {};

  models.forEach((model, index) => {
    // Create input tokens entry for this model
    config[`${model}_input`] = {
      label: `${model} Input`,
      color: colors[index % colors.length],
    };

    // Create output tokens entry for this model
    config[`${model}_output`] = {
      label: `${model} Output`,
      color: colors[(index + models.length) % colors.length],
    };
  });

  return config;
};

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

  // Extract unique models from the data
  const models = [...new Set(chartData.map((entry) => entry.model))];

  // Create dynamic chart config based on available models
  const chartConfigForModels = getChartConfig(models);

  // Group data by date for the chart
  const processedData = chartData.reduce(
    (acc: Record<string, any>[], entry) => {
      // Find if we already have an entry for this date
      const existingEntry = acc.find((item) => item.date === entry.date);

      if (existingEntry) {
        // Add model-specific token counts
        existingEntry[`${entry.model}_input`] = entry.inputTokens;
        existingEntry[`${entry.model}_output`] = entry.outputTokens;
      } else {
        // Create new entry for this date
        const newEntry: Record<string, any> = { date: entry.date };
        newEntry[`${entry.model}_input`] = entry.inputTokens;
        newEntry[`${entry.model}_output`] = entry.outputTokens;
        acc.push(newEntry);
      }

      return acc;
    },
    [],
  );

  // Calculate totals and cost
  const tokenPricing = {
    "gpt-4.1-nano": { inputToken: 0.1 / 1000000, outputToken: 0.4 / 1000000 },
    "gpt-4.1-mini": { inputToken: 0.15 / 1000000, outputToken: 0.6 / 1000000 },
  };

  const totalsByModel = chartData.reduce(
    (acc, entry) => {
      if (!acc[entry.model]) {
        acc[entry.model] = { input: 0, output: 0 };
      }
      acc[entry.model].input += entry.inputTokens;
      acc[entry.model].output += entry.outputTokens;
      return acc;
    },
    {} as Record<string, { input: number; output: number }>,
  );

  const totalCost = Object.entries(totalsByModel).reduce(
    (cost, [model, tokens]) => {
      const pricing = tokenPricing[model as keyof typeof tokenPricing];
      if (pricing) {
        return (
          cost +
          tokens.input * pricing.inputToken +
          tokens.output * pricing.outputToken
        );
      }
      return cost;
    },
    0,
  );

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
        <ChartContainer config={chartConfigForModels}>
          <AreaChart
            accessibilityLayer
            data={processedData}
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
            {models.flatMap((model) => [
              <Area
                key={`${model}_input`}
                dataKey={`${model}_input`}
                type="natural"
                fill={chartConfigForModels[`${model}_input`].color}
                fillOpacity={0.4}
                stroke={chartConfigForModels[`${model}_input`].color}
                stackId="a"
              />,
              <Area
                key={`${model}_output`}
                dataKey={`${model}_output`}
                type="natural"
                fill={chartConfigForModels[`${model}_output`].color}
                fillOpacity={0.4}
                stroke={chartConfigForModels[`${model}_output`].color}
                stackId="a"
              />,
            ])}
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
