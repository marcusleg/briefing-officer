import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface ReadingTimeBadgeProps {
  minutes: number;
}

export const ReadingTimeBadge = ({ minutes }: ReadingTimeBadgeProps) => {
  const roundedMinutes = Math.ceil(minutes);

  return (
    <Badge className="text-muted-foreground" variant="outline">
      <Clock className="mr-2 h-4 w-4" />
      {roundedMinutes} min read
    </Badge>
  );
};
