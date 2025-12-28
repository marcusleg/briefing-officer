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
import { deleteCategory } from "@/lib/repository/feedRepository";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FeedCategory } from "../../../../../prisma/generated/prisma/client";

interface DeleteCategoryDialogProps {
  category: FeedCategory;
  open: boolean;
  setIsDialogOpen: (open: boolean) => void;
}

const DeleteCategoryDialog = ({
  category,
  open,
  setIsDialogOpen,
}: DeleteCategoryDialogProps) => {
  const router = useRouter();
  const [deletionInProgress, setDeletionInProgress] = useState(false);

  const handleDelete = async () => {
    setDeletionInProgress(true);
    await deleteCategory(category.id);
    setDeletionInProgress(false);
    setIsDialogOpen(false);

    router.push("/feed");
  };

  return (
    <AlertDialog open={open} onOpenChange={setIsDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete the category. Feeds in this category will not be
            deleted; they will be uncategorized.
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

export default DeleteCategoryDialog;
