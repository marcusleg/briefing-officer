"use client";

import DeleteFeedDialog from "@/components/feed/DeleteFeedDialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Feed } from "@prisma/client";
import { Trash } from "lucide-react";
import { useState } from "react";

interface DeleteFeedButtonProps {
  feed: Feed;
}

const DeleteFeedButton = ({ feed }: DeleteFeedButtonProps) => {
  const [isDeleteFeedDialogOpen, setIsDeleteFeedDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Button
              onClick={() => setIsDeleteFeedDialogOpen(true)}
              variant="outline"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DeleteFeedDialog
        feed={feed}
        open={isDeleteFeedDialogOpen}
        onOpenChange={setIsDeleteFeedDialogOpen}
      />
    </>
  );
};

export default DeleteFeedButton;
