"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { refreshFeeds } from "@/lib/repository/feedRepository";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const RefreshAllFeedsButton = () => {
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = async () => {
    setRefreshing(true);
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

      setRefreshing(false);
      return;
    }
    setRefreshing(false);

    toast.message("All feeds refreshed");
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={refreshing}
            onClick={handleClick}
            size="icon"
            variant="outline"
          >
            {refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Refresh all feeds</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default RefreshAllFeedsButton;
