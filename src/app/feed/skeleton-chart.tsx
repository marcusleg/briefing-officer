import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface SkeletonChartProps {
  title: string;
  description?: string;
}

/** Spaced like `ChartCard`, so the dashboard doesn't jump once data arrives. */
const SkeletonChart = ({ title, description }: SkeletonChartProps) => {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-4">
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
};

export default SkeletonChart;
