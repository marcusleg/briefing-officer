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
import { FeedCategory } from "@prisma/client";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export default DeleteCategoryDialog;
