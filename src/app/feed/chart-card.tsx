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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className={containerClassName}>
          {children as React.ComponentProps<typeof ChartContainer>["children"]}
        </ChartContainer>
      </CardContent>
      {footer && (
        <CardFooter className="text-center text-sm font-medium">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
};

export default ChartCard;
