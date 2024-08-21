import { Button } from "@/components/ui/button";
import { Ellipsis } from "lucide-react";

interface AdditionalFeedActionsButtonProps {
  feedId: number;
}

const AdditionalFeedActionsButton = ({
  feedId,
}: AdditionalFeedActionsButtonProps) => {
  return (
    <Button variant="outline" size="icon">
      <Ellipsis />
    </Button>
  );
};

export default AdditionalFeedActionsButton;
