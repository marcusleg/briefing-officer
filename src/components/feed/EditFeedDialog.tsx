"use client";

import FeedForm from "@/components/feed/FeedForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Feed } from "@prisma/client";

interface RenameFeedMenuItemProps {
  feed: Feed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditFeedDialog = ({
  feed,
  open,
  onOpenChange,
}: RenameFeedMenuItemProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit feed</DialogTitle>
        </DialogHeader>

        <FeedForm
          editFeed={feed}
          onSubmitComplete={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditFeedDialog;
