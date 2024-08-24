"use client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { useParams } from "next/navigation";

interface FeedNavigationProps {}

interface FeedNavigationProps {
  feeds: Prisma.FeedGetPayload<{ include: { _count: true } }>[];
}

const FeedNavigation = ({ feeds }: FeedNavigationProps) => {
  const params = useParams<{ feedId: string }>();

  return (
    <nav className="flex flex-row flex-wrap justify-evenly gap-2 px-2 md:flex-col md:flex-nowrap">
      {feeds.map((feed) => (
        <Link
          key={feed.id}
          href={`/feed/${feed.id}`}
          className={cn(
            feed.id === parseInt(params.feedId)
              ? buttonVariants({ variant: "default", size: "sm" })
              : buttonVariants({ variant: "ghost", size: "sm" }),
            "justify-start font-bold md:w-full",
          )}
        >
          <div className="mr-2">{feed.title}</div>
          <Badge className="ml-auto" variant="secondary">
            {feed._count.articles}
          </Badge>
        </Link>
      ))}
    </nav>
  );
};

export default FeedNavigation;
