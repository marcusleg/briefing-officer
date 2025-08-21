"use client";

import { Button } from "@/components/ui/button";
import { refreshFeed } from "@/lib/repository/feedRepository";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleCLick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshFeed(feedId);
    } catch (error) {
      toast.error("An error occurred refreshing this feed.", {
        description: "Please check the server logs to learn more.",
      });
    }
    setRefreshInProgress(false);

    toast.message("Your feed has been refreshed.");
  };

  return (
    <Button
      className="cursor-pointer"
      disabled={refreshInProgress}
      onClick={handleCLick}
      variant="outline"
    >
      {refreshInProgress ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RotateCw className="mr-2 h-4 w-4" />
      )}
      Refresh
    </Button>
  );
};

export default RefreshFeedButton;
