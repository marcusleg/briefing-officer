"use client";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import { refreshFeeds } from "@/lib/repository/feedRepository";
import { LoaderCircleIcon, RotateCwIcon } from "lucide-react";
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
    <SidebarMenuButton onClick={handleClick} disabled={refreshing}>
      {refreshing ? (
        <LoaderCircleIcon className="h-4 w-4 animate-spin" />
      ) : (
        <RotateCwIcon className="h-4 w-4" />
      )}
      <span className="truncate">Refresh All Feeds</span>
    </SidebarMenuButton>
  );
};

export default RefreshAllFeedsButton;
