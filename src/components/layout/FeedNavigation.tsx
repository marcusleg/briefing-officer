"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Feed } from "@prisma/client";

interface FeedNavigationProps {
  feeds: Feed[];
}

const FeedNavigation = ({ feeds }: FeedNavigationProps) => {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {feeds.map((feed) => (
        <Link
          key={feed.id}
          href={`/feed/${feed.id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "justify-start w-full font-bold",
          )}
        >
          {feed.title}
        </Link>
      ))}
    </nav>
  );
};

export default FeedNavigation;
