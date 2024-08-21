"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Feed } from "@prisma/client";
import { useParams } from "next/navigation";

interface FeedNavigationProps {
  feeds: Feed[];
}

const FeedNavigation = ({ feeds }: FeedNavigationProps) => {
  const params = useParams<{ feedId: string }>();

  return (
    <nav className="flex flex-col gap-2 px-2">
      {feeds.map((feed) => (
        <Link
          key={feed.id}
          href={`/feed/${feed.id}`}
          className={cn(
            feed.id === parseInt(params.feedId)
              ? buttonVariants({ variant: "default", size: "sm" })
              : buttonVariants({ variant: "ghost", size: "sm" }),
            "w-full justify-start font-bold",
          )}
        >
          {feed.title}
        </Link>
      ))}
    </nav>
  );
};

export default FeedNavigation;
