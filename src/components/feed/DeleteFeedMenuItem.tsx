"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteFeed } from "@/app/actions";

interface DeleteFeedMenuItemProps {
  feedTitle: string;
  feedId: number;
}

const DeleteFeedMenuItem = ({ feedId, feedTitle }: DeleteFeedMenuItemProps) => {
  const [deletionInProgress, setDeletionInProgress] = useState(false);

  const handleDelete = async () => {
    setDeletionInProgress(true);
    await deleteFeed(feedId);
    setDeletionInProgress(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Trash className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {feedTitle}?</AlertDialogTitle>
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

export default DeleteFeedMenuItem;
