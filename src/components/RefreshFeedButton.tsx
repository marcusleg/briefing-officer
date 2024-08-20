"use client";
import { refreshFeed } from "@/app/actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const router = useRouter();

  const handleClick = async () => {
    await refreshFeed(feedId);
    router.refresh();
  };

  return (
    <Button onClick={handleClick}>
      <RotateCw className="mr-2 h-4 w-4" />
      Refresh now
    </Button>
  );
};

export default RefreshFeedButton;
