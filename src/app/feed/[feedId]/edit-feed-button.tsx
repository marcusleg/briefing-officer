"use client";

import EditFeedDialog from "@/app/feed/[feedId]/edit-feed-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Feed } from "@prisma/client";
import { Pencil } from "lucide-react";
import { useState } from "react";

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
              <Pencil className="h-4 w-4" />
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
