"use client";

import AddCategoryDialog from "@/components/category/add-category-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { FeedCategory } from "../../../../../prisma/generated/prisma/client";

interface EditCategoryButtonProps {
  category: FeedCategory;
}

const EditCategoryButton = ({ category }: EditCategoryButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="cursor-pointer"
              onClick={() => setIsDialogOpen(true)}
              variant="outline"
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit Category</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AddCategoryDialog
        editCategory={category}
        open={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
      />
    </>
  );
};

export default EditCategoryButton;
