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
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

interface DeleteFeedDialogProps {
  feed: Feed;
  open: boolean;
  setIsDialogOpen: (open: boolean) => void;
}

const DeleteFeedDialog = ({
  feed,
  open,
  setIsDialogOpen,
}: DeleteFeedDialogProps) => {
  const [deletionInProgress, setDeletionInProgress] = useState(false);

  const handleDelete = async () => {
    setDeletionInProgress(true);
    await deleteFeed(feed.id);
    setDeletionInProgress(false);
    setIsDialogOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setIsDialogOpen}>
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
            {deletionInProgress ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteFeedDialog;
