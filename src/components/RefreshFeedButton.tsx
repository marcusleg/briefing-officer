"use client";
import { refreshFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  return (
    <Button onClick={() => refreshFeed(feedId)}>
      <RotateCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  );
};

export default RefreshFeedButton;
