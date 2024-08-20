"use client";
import { refreshFeed } from "@/app/actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const router = useRouter();

  const handleClick = async () => {
    await refreshFeed(feedId);
    router.refresh();
  };

  return <Button onClick={handleClick}>Refresh now</Button>;
};

export default RefreshFeedButton;
