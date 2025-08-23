"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markCategoryArticlesOlderThanXDaysAsRead } from "@/lib/repository/articleRepository";
import { BookCheck, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface MarkAsReadCategoryProps {
  disabled?: boolean;
  categoryId: number;
}

const MarkAsReadCategoryButton = ({
  disabled,
  categoryId,
}: MarkAsReadCategoryProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = async (days: number) => {
    try {
      const count = await markCategoryArticlesOlderThanXDaysAsRead(
        categoryId,
        days,
      );
      toast.message(`${count} articles marked as read.`);
    } catch (error) {
      toast.error("An error occurred marking articles as read.");
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
          <BookCheck className="mr-2 size-4" />
          Mark as read
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

export default MarkAsReadCategoryButton;
