"use client";

import DeleteFeedDialog from "@/components/feed/DeleteFeedDialog";
import EditFeedDialog from "@/components/feed/EditFeedDialog";
import { Button } from "@/components/ui/button";
import { Feed } from "@prisma/client";
import { Pencil, Trash } from "lucide-react";
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
      <Button onClick={() => setIsEditFeedDialogOpen(true)} variant="outline">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button onClick={() => setIsDeleteFeedDialogOpen(true)} variant="outline">
        <Trash className="h-4 w-4" />
      </Button>

      <DeleteFeedDialog
        feed={feed}
        open={isDeleteFeedDialogOpen}
        setIsDialogOpen={setIsDeleteFeedDialogOpen}
      />
      <EditFeedDialog
        feed={feed}
        open={isEditFeedDialogOpen}
        setIsDialogOpen={setIsEditFeedDialogOpen}
      />
    </>
  );
};

export default AdditionalFeedActionsButton;
