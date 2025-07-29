"use client";

import CategoryForm from "@/components/category/CategoryForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedCategory } from "@prisma/client";

interface AddCategoryDialogProps {
  editCategory?: FeedCategory;
  open: boolean;
  setIsDialogOpen: (open: boolean) => void;
}

const AddCategoryDialog = ({
  editCategory,
  open,
  setIsDialogOpen,
}: AddCategoryDialogProps) => {
  const dialogTitle = editCategory ? "Edit category" : "Add category";

  return (
    <Dialog open={open} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <CategoryForm
          editCategory={editCategory}
          onSubmitComplete={() => setIsDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AddCategoryDialog;
