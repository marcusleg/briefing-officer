"use client";

import { REFRESH_STARTED_MESSAGE } from "@/app/feed/refresh-all-feeds-button";
import { useLiveUpdates } from "@/components/live-updates";
import { Button } from "@/components/ui/button";
import { refreshFeed } from "@/lib/repository/feedRepository";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const { noteUserRefresh } = useLiveUpdates();
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleClick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshFeed(feedId);
      noteUserRefresh();
      toast.message(REFRESH_STARTED_MESSAGE);
    } catch {
      toast.error("An error occurred refreshing this feed.", {
        description: "Please check the server logs to learn more.",
      });
    } finally {
      setRefreshInProgress(false);
    }
  };

  return (
    <Button
      className="cursor-pointer"
      disabled={refreshInProgress}
      onClick={handleClick}
      variant="outline"
    >
      {refreshInProgress ? (
        <LoaderCircle className="mr-2 size-4 animate-spin" />
      ) : (
        <RotateCw className="mr-2 size-4" />
      )}
      Refresh
    </Button>
  );
};

export default RefreshFeedButton;
