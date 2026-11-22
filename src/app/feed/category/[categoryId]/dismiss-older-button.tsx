"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dismissCategoryArticlesOlderThanXDays } from "@/lib/repository/articleRepository";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DismissOlderCategoryButtonProps {
  disabled?: boolean;
  categoryId: number;
}

const DismissOlderCategoryButton = ({
  disabled,
  categoryId,
}: DismissOlderCategoryButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = async (days: number) => {
    try {
      const count = await dismissCategoryArticlesOlderThanXDays(
        categoryId,
        days,
      );
      toast.message(`${count} articles dismissed.`);
    } catch (error) {
      toast.error("An error occurred dismissing articles.");
    }
  };

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          className="cursor-pointer"
          disabled={disabled}
          variant="outline"
        >
          <CheckIcon className="mr-2 size-4" />
          Dismiss
          {isOpen ? (
            <ChevronDownIcon className="ml-2 size-4 rotate-180 transition-transform" />
          ) : (
            <ChevronDownIcon className="ml-2 size-4 transition-transform" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleClick(0)}>
          All articles
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick(1)}>
          Older than one day
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick(2)}>
          Older than two days
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick(3)}>
          Older than three days
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick(7)}>
          Older than one week
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleClick(14)}>
          Older than two weeks
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DismissOlderCategoryButton;
