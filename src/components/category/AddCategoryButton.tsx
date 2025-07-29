"use client";

import CategoryForm from "@/components/category/CategoryForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

const AddCategoryButton = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton>
          <PlusIcon />
          <span className="truncate">Add Category</span>
        </SidebarMenuButton>
      </DialogTrigger>

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

export default AddCategoryButton;
