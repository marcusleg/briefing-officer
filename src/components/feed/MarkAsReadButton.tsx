"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markArticlesOlderThanXDaysAsRead } from "@/lib/repository/articleRepository";
import { BookCheck, ChevronDownIcon } from "lucide-react";
import { useState } from "react";

interface MarkAllAsReadProps {
  disabled?: boolean;
  feedId: number;
}

const MarkAsReadButton = ({ disabled, feedId }: MarkAllAsReadProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = async (days: number) => {
    await markArticlesOlderThanXDaysAsRead(feedId, days);
  };

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button disabled={disabled} variant="outline">
          <BookCheck className="mr-2 h-4 w-4" />
          Mark as read
          {isOpen ? (
            <ChevronDownIcon className="ml-2 h-4 w-4 rotate-180 transition-transform" />
          ) : (
            <ChevronDownIcon className="ml-2 h-4 w-4 transition-transform" />
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

export default MarkAsReadButton;
