"use client";

import { Button } from "@/components/ui/button";
import { refreshFeeds } from "@/lib/repository/feedRepository";
import { LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const RefreshAllFeedsButton = () => {
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleClick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshFeeds();
    } catch (error) {
      toast.error("An error occurred refreshing your feeds.", {
        description: "Please check the server logs to find out more.",
        action: {
          label: "Try again",
          onClick: () => handleClick(),
        },
      });

      setRefreshInProgress(false);
      return;
    }
    setRefreshInProgress(false);

    toast.message("All feeds refreshed");
  };

  return (
    <Button
      className="cursor-pointer"
      disabled={refreshInProgress}
      onClick={handleClick}
      variant="outline"
    >
      {refreshInProgress ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <RotateCwIcon className="size-4" />
      )}
      <span className="truncate">Refresh</span>
    </Button>
  );
};

export default RefreshAllFeedsButton;
