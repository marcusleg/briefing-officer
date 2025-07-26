import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle } from "../ui/card";

interface SkeletonChartProps {
  title: string;
}

const SkeletonChart = ({ title }: SkeletonChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="mx-auto aspect-square max-h-[250px]">
        <Skeleton className="h-[200px] w-full" />
      </div>
    </Card>
  );
};

export default SkeletonChart;
