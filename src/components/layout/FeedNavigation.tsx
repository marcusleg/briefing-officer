"use client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import { NewspaperIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface FeedNavigationProps {}

interface FeedNavigationProps {
  feeds: Prisma.FeedGetPayload<{ include: { _count: true } }>[];
}

const FeedNavigation = ({ feeds }: FeedNavigationProps) => {
  const params = useParams<{ feedId: string }>();

  return (
    <>
      {feeds.map((feed) => (
        <Link
          key={feed.id}
          href={`/feed/${feed.id}`}
          className={cn(
            feed.id === parseInt(params.feedId)
              ? buttonVariants({ variant: "default", size: "sm" })
              : buttonVariants({ variant: "ghost", size: "sm" }),
            "max-w-52 justify-start font-bold",
          )}
        >
          <NewspaperIcon className="mr-2 h-4 w-4" />
          <div className="mr-2 truncate">{feed.title}</div>
          {feed._count.articles !== 0 && (
            <Badge className="ml-auto" variant="secondary">
              {feed._count.articles}
            </Badge>
          )}
        </Link>
      ))}
    </>
  );
};

export default FeedNavigation;
