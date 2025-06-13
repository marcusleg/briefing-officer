"use client";

import DeleteFeedDialog from "@/components/feed/DeleteFeedDialog";
import { Button } from "@/components/ui/button";
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
      <Button onClick={() => setIsDeleteFeedDialogOpen(true)} variant="outline">
        <Trash className="h-4 w-4" />
      </Button>

      <DeleteFeedDialog
        feed={feed}
        open={isDeleteFeedDialogOpen}
        onOpenChange={setIsDeleteFeedDialogOpen}
      />
    </>
  );
};

export default DeleteFeedButton;
