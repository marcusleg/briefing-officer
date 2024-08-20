"use client";
import { refreshFeed } from "@/app/actions";
import { useRouter } from "next/navigation";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  const router = useRouter();

  const handleClick = async () => {
    await refreshFeed(feedId);
    router.refresh();
  };

  return <button onClick={handleClick}>Refresh now</button>;
};

export default RefreshFeedButton;
