import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface SkeletonChartProps {
  title: string;
  description?: string;
}

const SkeletonChart = ({ title, description }: SkeletonChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <div className="mx-auto aspect-square max-h-[250px]">
        <Skeleton className="h-[200px] w-full" />
      </div>
    </Card>
  );
};

export default SkeletonChart;
