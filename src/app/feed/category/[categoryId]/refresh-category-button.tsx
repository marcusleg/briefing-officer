"use client";

import { Button } from "@/components/ui/button";
import { refreshCategoryFeeds } from "@/lib/repository/feedRepository";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RefreshCategoryButtonProps {
  categoryId: number;
}

const RefreshCategoryButton = ({ categoryId }: RefreshCategoryButtonProps) => {
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const handleClick = async () => {
    setRefreshInProgress(true);
    try {
      await refreshCategoryFeeds(categoryId);
      toast.message("Your category's feeds have been refreshed.");
    } catch (error) {
      toast.error("An error occurred refreshing this category.", {
        description: "Please check the server logs to learn more.",
      });
    } finally {
      setRefreshInProgress(false);
    }
  };

  return (
    <Button
      disabled={refreshInProgress}
      onClick={handleClick}
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

export default RefreshCategoryButton;
