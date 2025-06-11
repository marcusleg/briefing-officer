"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteFeed } from "@/lib/repository/feedRepository";
import { Feed } from "@prisma/client";
import { useState } from "react";

interface DeleteFeedDialogProps {
  feed: Feed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DeleteFeedDialog = ({
  feed,
  open,
  onOpenChange,
}: DeleteFeedDialogProps) => {
  const [deletionInProgress, setDeletionInProgress] = useState(false);

  const handleDelete = async () => {
    setDeletionInProgress(true);
    await deleteFeed(feed.id);
    setDeletionInProgress(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {feed.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the feed and all its articles.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletionInProgress}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deletionInProgress}
            onClick={handleDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteFeedDialog;
