"use client";

import { refreshFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const { toast } = useToast();

  const handleCLick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshFeed(feedId);
    } catch (error) {
      toast({
        title: "An error occurred refreshing this feed.",
        description: "Please check the server logs to learn more.",
        variant: "destructive",
      });
    }
    setRefreshInProgress(false);

    toast({
      title: "Your feed has been refreshed.",
      description: "The latest articles are now available.",
    });
  };

  return (
    <Button
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
