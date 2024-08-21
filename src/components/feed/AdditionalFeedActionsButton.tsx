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
import RenameFeedDialog from "@/components/feed/RenameFeedDialog";
import DeleteFeedDialog from "@/components/feed/DeleteFeedDialog";

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
          <RenameFeedDialog feedId={feedId} currentFeedTitle={feedTitle} />
          <DeleteFeedDialog feedTitle={feedTitle} feedId={feedId} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdditionalFeedActionsButton;
