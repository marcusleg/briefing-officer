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
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Feed } from "../../../../prisma/generated/prisma/client";

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
          <AlertDialogCancel
            className="w-24 cursor-pointer"
            disabled={deletionInProgress}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="w-24 cursor-pointer"
            disabled={deletionInProgress}
            onClick={handleDelete}
          >
            {deletionInProgress ? (
              <LoaderCircle className="size-4 animate-spin" />
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
