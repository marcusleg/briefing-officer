"use client";

import FeedForm from "@/components/feed/feed-form";
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
  setIsDialogOpen: (open: boolean) => void;
}

const EditFeedDialog = ({
  feed,
  open,
  setIsDialogOpen,
}: RenameFeedMenuItemProps) => {
  return (
    <Dialog open={open} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit feed</DialogTitle>
        </DialogHeader>

        <FeedForm
          editFeed={feed}
          onSubmitComplete={() => setIsDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditFeedDialog;
