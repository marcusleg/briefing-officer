import { FeedsForLeftNavigation } from "@/components/layout/LeftNavigation";
import LeftNavigationLink from "@/components/layout/LeftNavigationLink";
import { Badge } from "@/components/ui/badge";
import { NewspaperIcon } from "lucide-react";

interface FeedNavigationProps {}

interface FeedNavigationProps {
  feeds: FeedsForLeftNavigation;
}

const FeedNavigation = ({ feeds }: FeedNavigationProps) => {
  return (
    <>
      {feeds.map((feed) => (
        <LeftNavigationLink key={feed.id} href={`/feed/${feed.id}`}>
          <NewspaperIcon className="mr-2 h-4 w-4" />
          <div className="mr-2 truncate">{feed.title}</div>
          {feed._count.articles !== 0 && (
            <Badge className="ml-auto" variant="secondary">
              {feed._count.articles}
            </Badge>
          )}
        </LeftNavigationLink>
      ))}
    </>
  );
};

export default FeedNavigation;
