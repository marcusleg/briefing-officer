"use client";
import { markAllArticlesAsRead } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { BookCheck } from "lucide-react";

interface MarkAllAsReadProps {
  disabled?: boolean;
  feedId: number;
}

const MarkAllAsRead = ({ disabled, feedId }: MarkAllAsReadProps) => {
  const handleCLick = async () => {
    await markAllArticlesAsRead(feedId);
  };

  return (
    <Button disabled={disabled} onClick={handleCLick} variant="outline">
      <BookCheck className="mr-2 h-4 w-4" />
      Mark all as read
    </Button>
  );
};

export default MarkAllAsRead;
