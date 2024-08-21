"use client";
import { refreshFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
import { useState } from "react";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleCLick = async () => {
    setRefreshInProgress(true);
    await refreshFeed(feedId);
    setRefreshInProgress(false);
  };

  return (
    <Button
      disabled={refreshInProgress}
      onClick={handleCLick}
      variant="outline"
    >
      <RotateCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  );
};

export default RefreshFeedButton;
