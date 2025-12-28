"use client";

import EditFeedDialog from "@/app/feed/[feedId]/edit-feed-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Feed } from "../../../../prisma/generated/prisma/client";

interface EditFeedButtonProps {
  feed: Feed;
}

const EditFeedButton = ({ feed }: EditFeedButtonProps) => {
  const [isEditFeedDialogOpen, setIsEditFeedDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="cursor-pointer"
              onClick={() => setIsEditFeedDialogOpen(true)}
              variant="outline"
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit Feed</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <EditFeedDialog
        feed={feed}
        open={isEditFeedDialogOpen}
        setIsDialogOpen={setIsEditFeedDialogOpen}
      />
    </>
  );
};

export default EditFeedButton;
