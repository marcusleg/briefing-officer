"use client";

import EditFeedDialog from "@/components/feed/EditFeedDialog";
import { Feed } from "@prisma/client";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";

interface EditFeedButtonProps {
  feed: Feed;
}

const EditFeedButton = ({ feed }: EditFeedButtonProps) => {
  const [isEditFeedDialogOpen, setIsEditFeedDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsEditFeedDialogOpen(true)} variant="outline">
        <Pencil className="h-4 w-4" />
      </Button>

      <EditFeedDialog
        feed={feed}
        open={isEditFeedDialogOpen}
        onOpenChange={setIsEditFeedDialogOpen}
      />
    </>
  );
};

export default EditFeedButton;
