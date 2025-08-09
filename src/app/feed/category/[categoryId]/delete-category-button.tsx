"use client";

import DeleteCategoryDialog from "@/app/feed/category/[categoryId]/delete-category-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FeedCategory } from "@prisma/client";
import { Trash } from "lucide-react";
import { useState } from "react";

interface DeleteCategoryButtonProps {
  category: FeedCategory;
}

const DeleteCategoryButton = ({ category }: DeleteCategoryButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Trash className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Category</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DeleteCategoryDialog
        category={category}
        open={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
      />
    </>
  );
};

export default DeleteCategoryButton;
