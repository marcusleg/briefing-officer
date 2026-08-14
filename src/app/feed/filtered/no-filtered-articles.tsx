import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ShieldCheckIcon } from "lucide-react";

const NoFilteredArticles = () => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldCheckIcon />
        </EmptyMedia>
        <EmptyTitle>Nothing filtered out</EmptyTitle>
        <EmptyDescription>
          Nothing has been held back from you yet — neither by your interest
          profiles nor by your own Not interested calls.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export default NoFilteredArticles;
