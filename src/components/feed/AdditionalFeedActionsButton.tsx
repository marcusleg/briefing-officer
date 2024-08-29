import DeleteFeedMenuItem from "@/components/feed/DeleteFeedMenuItem";
import EditFeedMenuItem from "@/components/feed/EditFeedMenuItem";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Feed } from "@prisma/client";
import { Ellipsis } from "lucide-react";

interface AdditionalFeedActionsButtonProps {
  feed: Feed;
}

const AdditionalFeedActionsButton = ({
  feed,
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
          <EditFeedMenuItem feed={feed} />
          <DeleteFeedMenuItem feedTitle={feed.title} feedId={feed.id} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdditionalFeedActionsButton;
