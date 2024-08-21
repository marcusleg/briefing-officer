import DeleteFeedMenuItem from "@/components/feed/DeleteFeedMenuItem";
import RenameFeedMenuItem from "@/components/feed/RenameFeedMenuItem";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";

interface AdditionalFeedActionsButtonProps {
  feedId: number;
  feedTitle: string;
}

const AdditionalFeedActionsButton = ({
  feedId,
  feedTitle,
}: AdditionalFeedActionsButtonProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Feed</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <RenameFeedMenuItem feedId={feedId} currentFeedTitle={feedTitle} />
          <DeleteFeedMenuItem feedTitle={feedTitle} feedId={feedId} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdditionalFeedActionsButton;
