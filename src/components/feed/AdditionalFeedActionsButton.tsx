"use client";

import DeleteFeedDialog from "@/components/feed/DeleteFeedDialog";
import EditFeedDialog from "@/components/feed/EditFeedDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Feed } from "@prisma/client";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { useState } from "react";

interface AdditionalFeedActionsButtonProps {
  feed: Feed;
}

const AdditionalFeedActionsButton = ({
  feed,
}: AdditionalFeedActionsButtonProps) => {
  const [isDeleteFeedDialogOpen, setIsDeleteFeedDialogOpen] = useState(false);
  const [isEditFeedDialogOpen, setIsEditFeedDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Feed</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setIsEditFeedDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsDeleteFeedDialogOpen(true)}>
              <Trash className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteFeedDialog
        feed={feed}
        open={isDeleteFeedDialogOpen}
        onOpenChange={setIsDeleteFeedDialogOpen}
      />
      <EditFeedDialog
        feed={feed}
        open={isEditFeedDialogOpen}
        onOpenChange={setIsEditFeedDialogOpen}
      />
    </>
  );
};

export default AdditionalFeedActionsButton;
