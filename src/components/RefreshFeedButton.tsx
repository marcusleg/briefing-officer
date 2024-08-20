"use client";
import { refreshFeed } from "@/app/actions";

interface RefreshFeedButtonProps {
  feedId: number;
}

const RefreshFeedButton = ({ feedId }: RefreshFeedButtonProps) => {
  return <button onClick={() => refreshFeed(feedId)}>Refresh now</button>;
};

export default RefreshFeedButton;
