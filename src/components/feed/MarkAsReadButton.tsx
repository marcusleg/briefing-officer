"use client";

import { markArticlesOlderThanXDaysAsRead } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookCheck } from "lucide-react";

interface MarkAllAsReadProps {
  disabled?: boolean;
  feedId: number;
}

const MarkAsReadButton = ({ disabled, feedId }: MarkAllAsReadProps) => {
  const handleClick = async (days: number) => {
    await markArticlesOlderThanXDaysAsRead(feedId, days);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled}>
        <Button disabled={disabled} variant="outline">
          <BookCheck className="mr-2 h-4 w-4" />
          Mark as read
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
