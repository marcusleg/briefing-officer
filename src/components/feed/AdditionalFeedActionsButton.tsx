import { Button } from "@/components/ui/button";
import { Ellipsis, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RenameFeedMenuItem from "@/components/feed/RenameFeedMenuItem";
import DeleteFeedMenuItem from "@/components/feed/DeleteFeedMenuItem";

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
