"use client";

import { ReactNode } from "react";

import SkeletonChart from "@/app/feed/skeleton-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description: string;
  footer?: ReactNode;
  config: ChartConfig;
  data: unknown;
  children: ReactNode;
  containerClassName?: string;
}

const ChartCard = ({
  title,
  description,
  footer,
  config,
  data,
  children,
  containerClassName,
}: ChartCardProps) => {
  if (data === undefined) {
    return <SkeletonChart title={title} description={description} />;
  }

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {/*
          A fixed height rather than the container's default `aspect-video`,
          which ties the height to the card's width and makes every card in a
          row taller the wider the columns get.
        */}
        <ChartContainer
          config={config}
          className={cn("aspect-auto h-40 w-full", containerClassName)}
        >
          {children as React.ComponentProps<typeof ChartContainer>["children"]}
        </ChartContainer>
      </CardContent>
      {footer && (
        // `mt-auto` pins the footer to the bottom of the card, so footers line
        // up across a row whose cards have headers of different heights.
        <CardFooter className="mt-auto px-4 text-center text-sm font-medium">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
};

export default ChartCard;
