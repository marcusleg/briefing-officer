"use client";

import CategoryForm from "@/components/category/category-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";

interface AddCategoryFormDialogTriggerProps {
  children: React.ReactNode;
}

const AddCategoryFormDialogTrigger = ({
  children,
}: AddCategoryFormDialogTriggerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a new category</DialogTitle>
          <DialogDescription>
            Create a category to organize your feeds.
          </DialogDescription>
        </DialogHeader>
        <CategoryForm onSubmitComplete={() => setDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default AddCategoryFormDialogTrigger;
