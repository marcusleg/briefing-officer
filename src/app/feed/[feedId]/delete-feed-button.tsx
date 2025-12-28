"use client";

import DeleteFeedDialog from "@/app/feed/[feedId]/delete-feed-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash } from "lucide-react";
import { useState } from "react";
import { Feed } from "../../../../prisma/generated/prisma/client";

interface DeleteFeedButtonProps {
  feed: Feed;
}

const DeleteFeedButton = ({ feed }: DeleteFeedButtonProps) => {
  const [isDeleteFeedDialogOpen, setIsDeleteFeedDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="cursor-pointer"
              onClick={() => setIsDeleteFeedDialogOpen(true)}
              variant="outline"
            >
              <Trash className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Feed</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DeleteFeedDialog
        feed={feed}
        open={isDeleteFeedDialogOpen}
        setIsDialogOpen={setIsDeleteFeedDialogOpen}
      />
    </>
  );
};

export default DeleteFeedButton;
