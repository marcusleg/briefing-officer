"use client";

import { refreshFeeds } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";

const RefreshAllFeedsButton = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setRefreshing(true);
    await refreshFeeds();
    setRefreshing(false);

    toast({
      title: "All feeds refreshed",
      description: "The latest articles for all feeds have been fetched.",
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
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
